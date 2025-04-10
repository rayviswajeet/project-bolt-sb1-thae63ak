import { addDays, differenceInDays, isFuture } from 'date-fns';
import { Task } from '@/types/task';
import { isHoliday } from '@/store/holidayStore';

/**
 * Calculate end date based on start date and duration
 * For duration = 1, end date = start date (same day)
 * For duration > 1, end date = start date + (duration - 1) days
 * Takes into account holiday exclusions based on settings
 */
export function calculateEndDate(startDate: Date, duration: number, excludeHolidays: boolean = true): Date {
  // For 1-day tasks, end date is the same as start date
  if (duration === 1) return new Date(startDate);
  
  // For regular calendar days without holiday exclusion
  if (!excludeHolidays) {
    return addDays(startDate, duration - 1);
  }

  // For days with holiday exclusion
  let result = new Date(startDate);
  let daysToAdd = duration - 1; // we count the start date itself as 1 day
  let daysAdded = 0;
  
  while (daysAdded < daysToAdd) {
    result = addDays(result, 1);
    
    // Skip this day if it's a holiday
    if (!isHoliday(result)) {
      daysAdded++;
    }
  }
  
  return result;
}

/**
 * Calculate duration between two dates
 * If start and end are the same day, duration = 1
 * Takes into account holiday exclusions based on settings
 */
export function calculateDuration(startDate: Date, endDate: Date, excludeHolidays: boolean = true): number {
  // If same day, duration is 1
  if (startDate.getFullYear() === endDate.getFullYear() && 
      startDate.getMonth() === endDate.getMonth() && 
      startDate.getDate() === endDate.getDate()) {
    return 1;
  }
  
  // If no holiday exclusion, just calculate total days
  if (!excludeHolidays) {
    return differenceInDays(endDate, startDate) + 1;
  }
  
  // Count working days between the dates
  let count = 0;
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (!isHoliday(currentDate)) {
      count++;
    }
    currentDate = addDays(currentDate, 1);
  }
  
  return count;
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
      updatedTask.endDate = calculateEndDate(updatedTask.startDate, updatedTask.duration, true);
    } else if (updatedTask.endDate && !updatedTask.duration) {
      updatedTask.duration = calculateDuration(updatedTask.startDate, updatedTask.endDate, true);
    } else if (updatedTask.duration && updatedTask.endDate) {
      // If all three exist, prioritize duration and recalculate end date
      updatedTask.endDate = calculateEndDate(updatedTask.startDate, updatedTask.duration, true);
    }
  }

  // Actual dates
  if (updatedTask.actualStartDate) {
    if (updatedTask.actualDuration && !updatedTask.actualEndDate) {
      updatedTask.actualEndDate = calculateEndDate(updatedTask.actualStartDate, updatedTask.actualDuration, true);
    } else if (updatedTask.actualEndDate && !updatedTask.actualDuration) {
      updatedTask.actualDuration = calculateDuration(updatedTask.actualStartDate, updatedTask.actualEndDate, true);
    } else if (updatedTask.actualDuration && updatedTask.actualEndDate) {
      updatedTask.actualDuration = calculateDuration(updatedTask.actualStartDate, updatedTask.actualEndDate, true);
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