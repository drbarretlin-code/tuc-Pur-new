/**
 * V33.2: AI 佇列狀態指示器
 * 當 aiQueue 有任務排隊時，在畫面右下角顯示浮動通知。
 */
import { useEffect, useState } from 'react';
import { useQueueStatus } from '../contexts/QueueContext';
import { Loader2, Clock, AlertTriangle } from 'lucide-react';

export default function QueueStatusBadge() {
  const { pending, isProcessing, isPaused, pauseRemainingMs } = useQueueStatus();
  const [remainingSecs, setRemainingSecs] = useState(0);
  const isActive = pending > 0 || isProcessing || isPaused;

  useEffect(() => {
    if (!isPaused) { setRemainingSecs(0); return; }
    const tick = setInterval(() => {
      setRemainingSecs(s => Math.max(0, s - 1));
    }, 1000);
    setRemainingSecs(Math.ceil(pauseRemainingMs / 1000));
    return () => clearInterval(tick);
  }, [isPaused, pauseRemainingMs]);

  if (!isActive) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.25rem',
      right: '1.25rem',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0.875rem',
      borderRadius: '999px',
      backdropFilter: 'blur(12px)',
      background: isPaused
        ? 'rgba(220, 38, 38, 0.15)'
        : 'rgba(30, 30, 60, 0.75)',
      border: `1px solid ${isPaused ? 'rgba(220,38,38,0.4)' : 'rgba(99,102,241,0.4)'}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      color: isPaused ? '#fca5a5' : '#c7d2fe',
      fontSize: '0.8125rem',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 500,
      transition: 'all 0.3s ease',
      animation: 'fadeInUp 0.3s ease',
      pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {isPaused ? (
        <>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>API 冷卻中，{remainingSecs} 秒後恢復</span>
        </>
      ) : (
        <>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          <Clock size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
          <span>
            {pending > 0
              ? `AI 佇列排隊中 ${pending} 個任務`
              : 'AI 請求處理中...'}
          </span>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
