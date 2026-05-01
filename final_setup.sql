-- 終極整合版 Supabase 初始化腳本 V2.0
-- 安全執行，不會報錯

-- 1. 建立所有核心資料表
CREATE TABLE IF NOT EXISTS public.specs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    title text DEFAULT '未命名規範表',
    requester text,
    department text,
    form_data jsonb NOT NULL,
    status text DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS tuc_history_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  source_file_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS tuc_uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  display_name TEXT NOT NULL,
  requester VARCHAR(100),
  equipment_name VARCHAR(255),
  equipment_tags TEXT[] DEFAULT '{}',
  requirement_desc TEXT,
  is_parsed BOOLEAN DEFAULT FALSE,
  is_calibrated BOOLEAN DEFAULT FALSE,
  parsed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  parse_status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  file_size BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tuc_system_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_tag TEXT,
  owner_session TEXT,
  status TEXT DEFAULT 'queued',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tuc_usage_stats (
    stat_date DATE PRIMARY KEY,
    qstash_calls_today INTEGER DEFAULT 0,
    estimated_egress_bytes BIGINT DEFAULT 0,
    last_ai_model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    gemini_rpd_today INTEGER DEFAULT 0,
    gemini_rpm_current INTEGER DEFAULT 0,
    gemini_rpm_last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 確保使用量統計表有最新的欄位
ALTER TABLE public.tuc_usage_stats ADD COLUMN IF NOT EXISTS gemini_rpd_today INTEGER DEFAULT 0;
ALTER TABLE public.tuc_usage_stats ADD COLUMN IF NOT EXISTS gemini_rpm_current INTEGER DEFAULT 0;
ALTER TABLE public.tuc_usage_stats ADD COLUMN IF NOT EXISTS gemini_rpm_last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.tuc_usage_stats ADD COLUMN IF NOT EXISTS qstash_calls_today INTEGER DEFAULT 0;
ALTER TABLE public.tuc_usage_stats ADD COLUMN IF NOT EXISTS estimated_egress_bytes BIGINT DEFAULT 0;

-- 2. 建立儲存桶 (Bucket)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('spec-files', 'spec-files', true)
ON CONFLICT (id) DO NOTHING;

-- 3. 設定所有資料表的 Row Level Security (RLS)
ALTER TABLE public.specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuc_history_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuc_uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuc_system_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuc_usage_stats ENABLE ROW LEVEL SECURITY;

-- 為了避免 "already exists" 報錯，先執行清除所有 Policy
DROP POLICY IF EXISTS "Allow public read-write for specs" ON public.specs;
DROP POLICY IF EXISTS "Allow all public insert" ON tuc_history_knowledge;
DROP POLICY IF EXISTS "Allow all public select" ON tuc_history_knowledge;
DROP POLICY IF EXISTS "Allow all public update" ON tuc_history_knowledge;
DROP POLICY IF EXISTS "Allow all public delete" ON tuc_history_knowledge;
DROP POLICY IF EXISTS "Allow all public insert" ON tuc_uploaded_files;
DROP POLICY IF EXISTS "Allow all public select" ON tuc_uploaded_files;
DROP POLICY IF EXISTS "Allow all public update" ON tuc_uploaded_files;
DROP POLICY IF EXISTS "Allow all public delete" ON tuc_uploaded_files;
DROP POLICY IF EXISTS "Allow all public" ON tuc_system_queue;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tuc_usage_stats;
DROP POLICY IF EXISTS "Allow public read-write for storage" ON storage.objects;

-- 重新建立乾淨的 Policy
CREATE POLICY "Allow public read-write for specs" ON public.specs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public insert" ON tuc_history_knowledge FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all public select" ON tuc_history_knowledge FOR SELECT USING (true);
CREATE POLICY "Allow all public update" ON tuc_history_knowledge FOR UPDATE USING (true);
CREATE POLICY "Allow all public delete" ON tuc_history_knowledge FOR DELETE USING (true);
CREATE POLICY "Allow all public insert" ON tuc_uploaded_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all public select" ON tuc_uploaded_files FOR SELECT USING (true);
CREATE POLICY "Allow all public update" ON tuc_uploaded_files FOR UPDATE USING (true);
CREATE POLICY "Allow all public delete" ON tuc_uploaded_files FOR DELETE USING (true);
CREATE POLICY "Allow all public" ON tuc_system_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read access for all users" ON public.tuc_usage_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read-write for storage" ON storage.objects FOR ALL USING (bucket_id = 'spec-files') WITH CHECK (bucket_id = 'spec-files');
GRANT SELECT ON public.tuc_usage_stats TO anon, authenticated;

-- 4. 建立函式
CREATE OR REPLACE FUNCTION get_knowledge_counts()
RETURNS TABLE(source_file_name TEXT, count BIGINT) 
LANGUAGE sql STABLE AS $$
  SELECT source_file_name, COUNT(*) as count
  FROM tuc_history_knowledge
  GROUP BY source_file_name;
$$;

-- 修復：新增 QStash 用量統計遞增函式
CREATE OR REPLACE FUNCTION increment_qstash_usage(bytes_count BIGINT DEFAULT 0, model_name TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
    today_date DATE := (timezone('utc'::text, now()))::date;
BEGIN
    INSERT INTO public.tuc_usage_stats (stat_date, qstash_calls_today, estimated_egress_bytes, last_ai_model)
    VALUES (today_date, 0, 0, model_name)
    ON CONFLICT (stat_date) DO NOTHING;

    UPDATE public.tuc_usage_stats
    SET 
        qstash_calls_today = COALESCE(qstash_calls_today, 0) + 1,
        estimated_egress_bytes = COALESCE(estimated_egress_bytes, 0) + bytes_count,
        last_ai_model = COALESCE(model_name, last_ai_model)
    WHERE stat_date = today_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 修復：新增 Gemini 用量統計遞增函式
CREATE OR REPLACE FUNCTION increment_gemini_usage(p_model_name TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
    today_date DATE := (timezone('utc'::text, now()))::date;
    current_minute TIMESTAMP WITH TIME ZONE := date_trunc('minute', now());
    v_last_update TIMESTAMP WITH TIME ZONE;
BEGIN
    INSERT INTO public.tuc_usage_stats (stat_date, gemini_rpd_today, gemini_rpm_current, gemini_rpm_last_update, last_ai_model)
    VALUES (today_date, 0, 0, now(), p_model_name)
    ON CONFLICT (stat_date) DO NOTHING;

    SELECT gemini_rpm_last_update INTO v_last_update 
    FROM public.tuc_usage_stats 
    WHERE stat_date = today_date;

    UPDATE public.tuc_usage_stats
    SET 
        gemini_rpd_today = COALESCE(gemini_rpd_today, 0) + 1,
        gemini_rpm_current = CASE 
            WHEN date_trunc('minute', v_last_update) = current_minute THEN COALESCE(gemini_rpm_current, 0) + 1
            ELSE 1
        END,
        gemini_rpm_last_update = now(),
        last_ai_model = COALESCE(p_model_name, last_ai_model)
    WHERE stat_date = today_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_qstash_usage(BIGINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_gemini_usage(TEXT) TO anon, authenticated;

-- 強制刷新快取
NOTIFY pgrst, 'reload schema';
