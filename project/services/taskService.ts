import { Task } from '@/types/task';
import { addDays, differenceInDays } from 'date-fns';

export function calculateEndDate(startDate: Date, duration: number): Date {
  return addDays(startDate, duration);
}

export function calculateDuration(startDate: Date, endDate: Date): number {
  return differenceInDays(endDate, startDate);
}

export function adjustDates(task: Partial<Task>): Partial<Task> {
  const updatedTask = { ...task };

  // Planned dates
  if (updatedTask.startDate) {
    if (updatedTask.duration && !updatedTask.endDate) {
      updatedTask.endDate = calculateEndDate(updatedTask.startDate, updatedTask.duration);
    } else if (updatedTask.endDate && !updatedTask.duration) {
      updatedTask.duration = calculateDuration(updatedTask.startDate, updatedTask.endDate);
    } else if (updatedTask.duration && updatedTask.endDate) {
      // If all three exist, prioritize endDate and adjust duration
      updatedTask.duration = calculateDuration(updatedTask.startDate, updatedTask.endDate);
    }
  }

  // Actual dates
  if (updatedTask.actualStartDate) {
    if (updatedTask.actualDuration && !updatedTask.actualEndDate) {
      updatedTask.actualEndDate = calculateEndDate(updatedTask.actualStartDate, updatedTask.actualDuration);
    } else if (updatedTask.actualEndDate && !updatedTask.actualDuration) {
      updatedTask.actualDuration = calculateDuration(updatedTask.actualStartDate, updatedTask.actualEndDate);
    } else if (updatedTask.actualDuration && updatedTask.actualEndDate) {
      updatedTask.actualDuration = calculateDuration(updatedTask.actualStartDate, updatedTask.actualEndDate);
    }
  }

  return updatedTask;
}

// 3. Services (services/taskService.ts)
// a. Transactional Integrity for Bulk Operations
// Current State: Bulk deletion uses $transaction, but updates are not atomic.
// Enhancement:
// Wrap all bulk updates in transactions for consistency.

// static async bulkUpdate(ids: string[], updates: TaskUpdate): Promise<void> {
//   const tasks = await this.getAllTasks();
//   const updatedTasks = tasks.map(t => ids.includes(t.id) ? { ...t, ...updates } : t);
//   const errors = updatedTasks.flatMap(t => validateTaskDates(t, updatedTasks));
//   if (errors.length) throw new Error(`Validation failed: ${errors.join(', ')}`);

//   await prisma.$transaction(
//     ids.map(id => prisma.task.update({
//       where: { id },
//       data: Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined))
//     }))
//   );

//   const finalTasks = await this.getAllTasks();
//   const syncedTasks = updateWbsNumbers(syncPredecessorIds(finalTasks));
//   await prisma.$transaction(
//     syncedTasks.map(t => prisma.task.update({ where: { id: t.id }, data: { wbsNo: t.wbsNo, predecessorIds: t.predecessorIds } }))
//   );
// }