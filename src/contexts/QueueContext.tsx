/**
 * V33.2: 全域佇列狀態廣播器
 * 讓 React 元件能訂閱 aiQueue 的即時狀態，以在 UI 呈現「排隊進度」。
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { setQueueNotifier } from '../lib/knowledgeParser';

export interface QueueStatus {
  pending: number;
  isProcessing: boolean;
  isPaused: boolean;
  pauseRemainingMs: number;
}

const defaultStatus: QueueStatus = {
  pending: 0,
  isProcessing: false,
  isPaused: false,
  pauseRemainingMs: 0,
};

const QueueContext = createContext<QueueStatus>(defaultStatus);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<QueueStatus>(defaultStatus);

  useEffect(() => {
    // 向 QueueManager 注入廣播函式
    setQueueNotifier((s: QueueStatus) => setStatus({ ...s }));
    return () => { setQueueNotifier(() => {}); };
  }, []);

  return (
    <QueueContext.Provider value={status}>
      {children}
    </QueueContext.Provider>
  );
}

export function useQueueStatus(): QueueStatus {
  return useContext(QueueContext);
}

