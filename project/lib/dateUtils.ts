import { addDays, differenceInDays, isFuture } from 'date-fns';
import { Task } from '@/types/task';

/**
 * Calculate end date based on start date and duration
 * For duration = 1, end date = start date (same day)
 * For duration > 1, end date = start date + (duration - 1) days
 */
export function calculateEndDate(startDate: Date, duration: number, excludeWeekends: boolean = false): Date {
  // For 1-day tasks, end date is the same as start date
  if (duration === 1) return new Date(startDate);
  
  if (!excludeWeekends) {
    // For regular calendar days, add (duration - 1) days
    return addDays(startDate, duration - 1);
  }

  // For business days with weekends excluded
  let result = new Date(startDate);
  let daysAdded = 0;
  
  // For multi-day tasks, add (duration - 1) business days
  while (daysAdded < duration - 1) {
    result = addDays(result, 1);
    // Only count weekdays (Monday-Friday)
    if (result.getDay() !== 0 && result.getDay() !== 6) daysAdded++;
  }
  
  return result;
}

/**
 * Calculate duration between two dates
 * If start and end are the same day, duration = 1
 */
export function calculateDuration(startDate: Date, endDate: Date): number {
  // If same day, duration is 1
  if (startDate.getFullYear() === endDate.getFullYear() && 
      startDate.getMonth() === endDate.getMonth() && 
      startDate.getDate() === endDate.getDate()) {
    return 1;
  }
  
  // Otherwise calculate difference in days and add 1
  return differenceInDays(endDate, startDate) + 1;
}

//Task Overlap Detection (Feature i - Additional Logic)
export function detectOverlaps(tasks: Task[]): string[] {
  const errors: string[] = [];
  const levelGroups = new Map<number, Task[]>();
  tasks.forEach(task => {
    if (!levelGroups.has(task.level)) levelGroups.set(task.level, []);
    levelGroups.get(task.level)?.push(task);
  });

  levelGroups.forEach(group => {
    group.forEach((taskA, i) => {
      group.slice(i + 1).forEach(taskB => {
        if (taskA.startDate && taskA.endDate && taskB.startDate && taskB.endDate &&
            taskA.startDate < taskB.endDate && taskB.startDate < taskA.endDate) {
          errors.push(`Overlap detected between ${taskA.taskName} and ${taskB.taskName}`);
        }
      });
    });
  });
  return errors;
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
      // If all three exist, prioritize duration and recalculate end date
      updatedTask.endDate = calculateEndDate(updatedTask.startDate, updatedTask.duration);
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

export function validateDateConstraints(task: Task, field: string, date: Date): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight for consistent date-only comparison

  switch (field) {
    case 'startDate':
      if (task.endDate && date > task.endDate) return 'Start date must be before or equal to end date';
      break;
    case 'endDate':
      if (task.startDate && date < task.startDate) return 'End date must be after or equal to start date';
      break;
    case 'actualStartDate':
      if (date > today) return 'Actual start date cannot be in the future';
      if (task.actualEndDate && date > task.actualEndDate) return 'Actual start date must be before or equal to actual end date';
      if (task.startDate && date < task.startDate) return 'Actual start date cannot be before planned start date';
      break;
    case 'actualEndDate':
      if (date > today) return 'Actual end date cannot be in the future';
      if (task.actualStartDate && date < task.actualStartDate) return 'Actual end date must be after or equal to actual start date';
      if (task.endDate && date < task.endDate) return 'Actual end date cannot be before planned end date';
      break;
  }
  return null;
}