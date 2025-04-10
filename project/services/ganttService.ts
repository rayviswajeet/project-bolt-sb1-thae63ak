import { Task } from '@/types/task';
import { addDays } from 'date-fns';

export interface GanttTask {
  id: string;
  text: string;
  start_date: Date;
  end_date: Date;
  progress: number;
  parent: string | null;
  type: 'task' | 'milestone';
  planned_start: Date | null;
  planned_end: Date | null;
  actual_start: Date | null;
  actual_end: Date | null;
  level: number;
  isFinancialMilestone: boolean;
  goLive: boolean;
  isCritical: boolean;
}

export interface GanttLink {
  id: string;
  source: string;
  target: string;
  type: string;
}

export class GanttService {
  /**
   * Converts a Task to a GanttTask format
   */
  static convertToGanttTask(task: Task): GanttTask {
    return {
      id: task.id,
      text: task.taskName,
      start_date: task.startDate || new Date(),
      end_date: task.endDate || addDays(task.startDate || new Date(), task.duration || 1),
      progress: this.calculateProgress(task),
      parent: null, // Will be set based on hierarchy
      type: task.isFinancialMilestone ? 'milestone' : 'task',
      planned_start: task.startDate ?? null,
      planned_end: task.endDate ?? null,
      actual_start: task.actualStartDate ?? null,
      actual_end: task.actualEndDate ?? null,
      level: task.level,
      isFinancialMilestone: task.isFinancialMilestone,
      goLive: task.goLive,
      isCritical: false // Will be calculated by the Gantt chart
    };
  }

  /**
   * Calculates the progress of a task based on its actual dates
   */
  static calculateProgress(task: Task): number {
    if (task.actualEndDate) return 1;
    if (!task.actualStartDate) return 0;
    
    const totalDuration = task.duration || 0;
    if (totalDuration === 0) return 0;

    const today = new Date();
    const actualStart = new Date(task.actualStartDate);
    const elapsed = Math.floor((today.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.min(1, Math.max(0, elapsed / totalDuration));
  }

  /**
   * Creates dependency links between tasks
   */
  static createDependencyLinks(tasks: Task[]): GanttLink[] {
    // Regular links between tasks
    const standardLinks = tasks
      .filter(task => task.predecessorIds)
      .flatMap(task => 
        task.predecessorIds!.split(',')
          .map(siNo => siNo.trim())
          .filter(siNo => siNo)
          .map(siNo => {
            const predecessor = tasks.find(t => t.siNo === Number(siNo));
            if (!predecessor) return null;
            
            // For level 0 tasks, create links to the diamond
            const targetId = task.level === 0 ? `diamond_${task.id}` : task.id;
            
            return {
              id: `${predecessor.id}-${targetId}`,
              source: predecessor.id,
              target: targetId,
              type: '0' // Finish-to-Start
            };
          })
      )
      .filter((link): link is GanttLink => link !== null);

    // Special links from diamonds to level 0 tasks
    const diamondLinks = tasks
      .filter(task => task.level === 0)
      .map(task => ({
        id: `diamond_${task.id}-${task.id}`,
        source: `diamond_${task.id}`,
        target: task.id,
        type: '0'
      }));

    return [...standardLinks, ...diamondLinks];
  }

  /**
   * Builds the task hierarchy based on task levels
   */
  static buildHierarchy(tasks: Task[]): GanttTask[] {
    const ganttTasks = tasks.map(task => this.convertToGanttTask(task));
    
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].level > 0) {
        // Find the nearest parent task
        for (let j = i - 1; j >= 0; j--) {
          if (tasks[j].level === tasks[i].level - 1) {
            ganttTasks[i].parent = tasks[j].id;
            break;
          }
        }
      }
    }

    return ganttTasks;
  }

  /**
   * Identifies the critical path in the task network
   */
  static calculateCriticalPath(tasks: Task[]): string[] {
    // This is a simplified critical path calculation
    // In a real implementation, we would use a proper algorithm like CPM
    
    // Sort tasks by end date (latest first)
    const sortedTasks = [...tasks]
      .filter(t => t.endDate)
      .sort((a, b) => {
        const aDate = a.endDate || new Date();
        const bDate = b.endDate || new Date();
        return bDate.getTime() - aDate.getTime();
      });
    
    if (sortedTasks.length === 0) return [];
    
    // Start with the task that ends last
    const criticalPath: string[] = [sortedTasks[0].id];
    let currentTask = sortedTasks[0];
    
    // Trace back through predecessors
    while (currentTask.predecessorIds) {
      const predecessorSiNos = currentTask.predecessorIds.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
      
      if (predecessorSiNos.length === 0) break;
      
      // Find the predecessor that ends latest
      const predecessors = tasks.filter(t => predecessorSiNos.includes(t.siNo) && t.endDate);
      if (predecessors.length === 0) break;
      
      const latestPredecessor = predecessors.reduce((latest, current) => {
        const latestDate = latest.endDate || new Date(0);
        const currentDate = current.endDate || new Date(0);
        return currentDate > latestDate ? current : latest;
      }, predecessors[0]);
      
      criticalPath.push(latestPredecessor.id);
      currentTask = latestPredecessor;
    }
    
    return criticalPath;
  }
}