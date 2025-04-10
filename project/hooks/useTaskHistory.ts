import { useState, useEffect } from 'react';
import { Task } from '@/types/task';

interface TaskHistory {
  id: string;
  taskId: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, any>;
  createdAt: Date;
}

export function useTaskHistory(taskId: string) {
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(`/api/tasks/${taskId}/history`);
        if (!response.ok) throw new Error('Failed to fetch task history');
        const data = await response.json();
        setHistory(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [taskId]);

  return { history, loading, error };
}