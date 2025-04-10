'use client';

import { useTaskHistory } from '@/hooks/useTaskHistory';
import { format } from 'date-fns';

interface TaskHistoryProps {
  taskId: string;
}

export default function TaskHistory({ taskId }: TaskHistoryProps) {
  const { history, loading, error } = useTaskHistory(taskId);

  if (loading) return <div>Loading history...</div>;
  if (error) return <div>Error loading history: {error.message}</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Task History</h3>
      <div className="space-y-2">
        {history.map(entry => (
          <div key={entry.id} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start">
              <span className="font-medium capitalize">{entry.action}</span>
              <span className="text-sm text-gray-500">
                {format(new Date(entry.createdAt), 'PPpp')}
              </span>
            </div>
            <div className="mt-2 text-sm">
              {Object.entries(entry.changes).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-medium">{key}:</span>
                  <span>{JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Audit Trail Integration (Feature i - Additional Logic)
// Current State: No logging of changes.
// Enhancement:
// Add a TaskHistory table and log all updates.

// static async logChange(taskId: string, action: string, changes: Record<string, any>) {
//   await prisma.taskHistory.create({
//     data: { taskId, action, changes: JSON.stringify(changes), createdAt: new Date() }
//   });
// }

// static async updateTask(id: string, updates: TaskUpdate): Promise<Task> {
//   const currentTask = await prisma.task.findUnique({ where: { id } });
//   if (!currentTask) throw new Error('Task not found');
//   const adjustedData = adjustTaskDatesWithPredecessors(updates, await this.getAllTasks());
//   const errors = validateTaskDates({ ...currentTask, ...adjustedData } as Task, await this.getAllTasks());
//   if (errors.length) throw new Error(`Validation failed: ${errors.join(', ')}`);

//   const data = Object.fromEntries(Object.entries(adjustedData).filter(([_, v]) => v !== undefined));
//   const updatedTask = await prisma.task.update({ where: { id }, data });
//   await this.logChange(id, 'update', updates);
//   return updatedTask;
// }