import os

file_path = '/Users/barretlin/Documents/Antigravity_Files/tuc-Purchase-main/knowledgeParser_v520.ts'
target_path = '/Users/barretlin/Documents/Antigravity_Files/tuc-Purchase-main/src/lib/knowledgeParser.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Replace getAutoSelectedModel (approx lines 95-275 in v520)
# We find it by looking for the function signature
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if 'export async function getAutoSelectedModel' in line:
        start_idx = i
    if start_idx != -1 and line.strip() == '}':
        # Check if this is the end of the function (rough check)
        if i + 1 < len(lines) and (lines[i+1].startswith('/**') or lines[i+1].startswith('export')):
             end_idx = i
             break

new_get_auto_model = """export async function getAutoSelectedModel(keys: string | string[]): Promise<{ modelId: string; apiKey: string }> {
  if (typeof keys === 'string') keys = [keys];
  const priorityList = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
  ];

  if (!(globalThis as any)._TUC_INVALID_MODELS) (globalThis as any)._TUC_INVALID_MODELS = new Set<string>();
  const invalidModels = (globalThis as any)._TUC_INVALID_MODELS;

  if (!(globalThis as any)._TUC_RPD_EXHAUSTED_SET) (globalThis as any)._TUC_RPD_EXHAUSTED_SET = new Set<string>();
  const rpdExhaustedSet: Set<string> = (globalThis as any)._TUC_RPD_EXHAUSTED_SET;

  const keyHealthJson = localStorage.getItem('_TUC_KEY_HEALTH') || '{}';
  const keyHealth = JSON.parse(keyHealthJson);
  const now = Date.now();

  const rpdResetKey = new Date().toISOString().split('T')[0];
  if (localStorage.getItem('_TUC_RPD_DAY') !== rpdResetKey) {
    (globalThis as any)._TUC_RPD_EXHAUSTED_SET = new Set<string>();
    localStorage.setItem('_TUC_RPD_DAY', rpdResetKey);
  }

  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    if (!currentKey) continue;
    const keyId = currentKey.substring(0, 10);
    if (keyHealth[keyId] && now < keyHealth[keyId]) continue;

    for (const mId of priorityList) {
      if (invalidModels.has(mId)) continue; 
      if (rpdExhaustedSet.has(`${keyId}_${mId}`)) continue;
      
      // V30.3: 零探針模式
      cachedModelId = mId;
      localStorage.setItem('tuc_gemini_key', currentKey);
      return { modelId: mId, apiKey: currentKey };
    }
  }

  // 兜底：如果全部都失效，回傳第一個
  return { modelId: priorityList[0], apiKey: keys[0] };
}
"""

new_sync_function = """
/**
 * V30.3: 單次全量翻譯同步 (Full Document Translation)
 * 解決 20 RPD 限制的核心方案：1 個文件更新 = 1 次 API 請求
 */
export async function translateFullBilingualState(
  payload: Record<string, string>,
  targetLang: string,
  apiKeys: string | string[]
): Promise<Record<string, string>> {
  if (Object.keys(payload).length === 0) return {};

  const { modelId, apiKey: workingKey } = await getAutoSelectedModel(apiKeys);
  const genAI = new GoogleGenerativeAI(workingKey);
  const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

  const prompt = `You are a professional Thai-Chinese procurement spec translator.
TASK: Translate the following JSON object's values from Thai into Traditional Chinese (Taiwan).
CONSTRAINTS:
1. Return ONLY a valid JSON object with the same keys.
2. Maintain technical terms like PLC, SUS304, HMI, ISO in English.
3. If a value is already Chinese or English, keep it as is.
4. Output should be professional, suitable for engineering procurement documents.

INPUT JSON:
${JSON.stringify(payload, null, 2)}`;

  try {
    trackGeminiUsage(cachedModelId);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err: any) {
    console.error('[AI Sync] Full state translation failed:', err);
    const errMsg = err.message || '';
    
    // 503/500: 模型過載
    if (errMsg.includes('503') || errMsg.includes('500') || errMsg.includes('high demand')) {
      const failedModel = cachedModelId || 'unknown';
      if (!(globalThis as any)._TUC_INVALID_MODELS) (globalThis as any)._TUC_INVALID_MODELS = new Set<string>();
      (globalThis as any)._TUC_INVALID_MODELS.add(failedModel);
      invalidateCachedModel();
      if (Array.isArray(apiKeys) && apiKeys.length > 0) return translateFullBilingualState(payload, targetLang, apiKeys);
      throw new Error('MODEL_OVERLOADED');
    }

    // 429: 配額耗盡
    if (errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('exhausted')) {
      const isRPD = errMsg.includes('PerDay') || errMsg.includes('PerDayPerProject');
      if (isRPD) {
        const rpdKey = `${workingKey.substring(0, 10)}_${cachedModelId || 'unknown'}`;
        if (!(globalThis as any)._TUC_RPD_EXHAUSTED_SET) (globalThis as any)._TUC_RPD_EXHAUSTED_SET = new Set<string>();
        (globalThis as any)._TUC_RPD_EXHAUSTED_SET.add(rpdKey);
        invalidateCachedModel();
        if (Array.isArray(apiKeys) && apiKeys.length > 0) return translateFullBilingualState(payload, targetLang, apiKeys);
        throw new Error('RPD_EXHAUSTED');
      }
      
      const delayMatch = errMsg.match(/retry in (\\d+(\\.\\d+)?)/);
      const delaySec = delayMatch ? parseFloat(delayMatch[1]) : 60;
      const keyId = workingKey.substring(0, 10);
      const keyHealth = JSON.parse(localStorage.getItem('_TUC_KEY_HEALTH') || '{}');
      keyHealth[keyId] = Date.now() + (delaySec * 1000);
      localStorage.setItem('_TUC_KEY_HEALTH', JSON.stringify(keyHealth));
      invalidateCachedModel();
      if (Array.isArray(apiKeys) && apiKeys.length > 0) return translateFullBilingualState(payload, targetLang, apiKeys);
      throw new Error('RATE_LIMIT');
    }
    throw err;
  }
}
"""

if start_idx != -1 and end_idx != -1:
    new_lines = lines[:start_idx] + [new_get_auto_model] + lines[end_idx+1:]
    new_lines.append(new_sync_function)
    with open(target_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully refactored knowledgeParser.ts")
else:
    print(f"Failed to find getAutoSelectedModel indices: {start_idx}, {end_idx}")
