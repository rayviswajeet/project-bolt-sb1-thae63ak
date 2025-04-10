import { Task, TaskUpdate } from '@/types/task';
import { addDays } from 'date-fns';
import { adjustDates, calculateEndDate, calculateDuration } from './dateUtils';

/**
 * Calculates the maximum end date from all predecessor tasks
 * @param tasks All tasks in the project
 * @param predecessorIds Comma-separated string of predecessor SI numbers
 * @returns The latest end date among all predecessors or null if none found
 */
export function getMaxPredecessorEndDate(tasks: Task[], predecessorIds: string): Date | null {
  if (!predecessorIds?.trim()) return null;
  
  // Parse comma-separated SI numbers into an array of integers, filtering out invalid values
  const siNos = predecessorIds.split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id));
  
  if (siNos.length === 0) return null;
  
  // Filter tasks to get valid predecessors (not deleted and matching SI numbers)
  const predecessors = tasks.filter(t => 
    !t.isDeleted && siNos.includes(t.siNo) && t.endDate
  );
  
  if (predecessors.length === 0) return null;
  
  // Find the maximum end date among all predecessors
  const endDates = predecessors.map(t => t.endDate as Date);
  return new Date(Math.max(...endDates.map(d => d.getTime())));
}

/**
 * Adjusts task dates based on predecessor constraints
 * @param task The task to adjust
 * @param allTasks All tasks in the project
 * @returns The task with adjusted dates
 */
export function adjustTaskDatesWithPredecessors(task: TaskUpdate, allTasks: Task[]): TaskUpdate {
  // If no predecessors, just adjust dates normally
  if (!task.predecessorIds?.trim() || task.predecessorIds === '0') return adjustDates(task);

  const maxPredEndDate = getMaxPredecessorEndDate(allTasks, task.predecessorIds);
  if (maxPredEndDate) {
    // Set start date to one day after the max predecessor end date
    const newStartDate = addDays(maxPredEndDate, 1);

    // Update start date only if it's unset or earlier than required
    if (!task.startDate || task.startDate <= maxPredEndDate) {
      // Store the original duration before making any changes
      const originalDuration = task.duration;
      
      // Set the new start date
      task.startDate = newStartDate;
      
      // If the task has a valid duration, always recalculate the end date based on that duration
      if (originalDuration !== undefined && originalDuration !== null && originalDuration > 0) {
        task.endDate = calculateEndDate(newStartDate, originalDuration);
        task.duration = originalDuration; // Ensure duration remains unchanged
      }
      // If no valid duration but end date exists, calculate duration from the dates
      else if (task.endDate) {
        const differenceInMilliseconds = task.endDate.getTime() - newStartDate.getTime();
        const differenceInDays = Math.ceil(differenceInMilliseconds / (1000 * 60 * 60 * 24));
        task.duration = Math.max(1, differenceInDays + 1); // Add 1 to include both start and end date
      }
      // If neither duration nor end date is set, assign a default duration
      else {
        task.duration = 1; // Default to 1 day
        task.endDate = new Date(newStartDate); // For 1 day, end date equals start date
      }
    }
  }

  // Handle actual duration and progress
  if (task.actualStartDate && task.actualEndDate) {
    task.actualDuration = calculateDuration(task.actualStartDate, task.actualEndDate);
  } else {
    task.actualDuration = null;
  }

  // Ensure progress is not automatically changed when setting actual start date
  if (task.actualEndDate) {
    task.progress = 100;
  }

  return adjustDates(task);
}

/**
 * Updates all tasks that depend on the updated task
 * @param tasks All tasks in the project
 * @param updatedTask The task that was updated
 * @returns Updated list of tasks with dependencies adjusted
 */
export function updateDependentTasks(tasks: Task[], updatedTask: Task): Task[] {
  const updatedTasks = [...tasks];
  const taskIdx = updatedTasks.findIndex(t => t.id === updatedTask.id);
  if (taskIdx === -1) return updatedTasks;

  // Update the task in the list
  updatedTasks[taskIdx] = updatedTask;

  // Track processed tasks to avoid circular dependency loops
  const processedTasks = new Set<string>();

  function updateDependents(taskId: string) {
    if (processedTasks.has(taskId)) return; // Prevent infinite loops
    processedTasks.add(taskId);

    // Find tasks that depend on the updated task
    const dependentTasks = updatedTasks.filter(t =>
      !t.isDeleted && 
      t.predecessorIds?.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id))
        .includes(updatedTasks.find(ut => ut.id === taskId)?.siNo || -1)
    );

    for (const dependent of dependentTasks) {
      const idx = updatedTasks.findIndex(t => t.id === dependent.id);
      if (idx !== -1) {
        const originalDates = {
          startDate: dependent.startDate,
          endDate: dependent.endDate
        };
        
        const adjustedTask = adjustTaskDatesWithPredecessors(dependent, updatedTasks);
        updatedTasks[idx] = { ...dependent, ...adjustedTask };
        
        // If dates changed, recursively update its dependents
        if (
          originalDates.startDate?.getTime() !== updatedTasks[idx].startDate?.getTime() || 
          originalDates.endDate?.getTime() !== updatedTasks[idx].endDate?.getTime()
        ) {
          updateDependents(dependent.id); // Recursively update dependents
        }
      }
    }
  }

  updateDependents(updatedTask.id);
  return updatedTasks;
}

/**
 * Validates task dates for consistency
 * @param task The task to validate
 * @param allTasks All tasks in the project
 * @returns Array of error messages, empty if valid
 */
export function validateTaskDates(task: TaskUpdate, allTasks: Task[]): string[] {
  const errors: string[] = [];
  
  // Check start date is before end date
  if (task.startDate && task.endDate && 
      task.startDate >= task.endDate) {
    errors.push('Start date must be before end date');
  }

  // Check task starts after all predecessors end
  if (task.predecessorIds?.trim() && task.startDate) {
    const maxPredEndDate = getMaxPredecessorEndDate(allTasks, task.predecessorIds);
    if (maxPredEndDate && task.startDate <= maxPredEndDate) {
      errors.push('Start date must be after all predecessor end dates');
    }
  }

  return errors;
}

/**
 * Finds all ancestors of a task (parent, grandparent, etc. up to level 0)
 * @param tasks All tasks in the project
 * @param task The task to find ancestors for
 * @returns Array of ancestor tasks
 */
export function findAncestors(tasks: Task[], task: Task): Task[] {
  if (task.level === 0) return []; // Level 0 tasks have no ancestors
  
  const ancestors: Task[] = [];
  const taskIndex = tasks.findIndex(t => t.id === task.id);
  if (taskIndex === -1) return [];
  
  // Look backwards from the task to find all ancestors
  let currentLevel = task.level;
  for (let i = taskIndex - 1; i >= 0; i--) {
    const potentialAncestor = tasks[i];
    
    // If we find a task with lower level, it's an ancestor
    if (potentialAncestor.level < currentLevel) {
      ancestors.push(potentialAncestor);
      currentLevel = potentialAncestor.level;
      
      // If we've reached level 0, we're done
      if (currentLevel === 0) break;
    }
  }
  
  return ancestors;
}

/**
 * Validates predecessor references
 * @param task The task being validated
 * @param predecessorIds Comma-separated string of predecessor SI numbers
 * @param tasks All tasks in the project
 * @returns Array of error messages, empty if valid
 */
export function validatePredecessors(task: Task, predecessorIds: string, tasks: Task[]): string[] {
  const errors: string[] = [];
  if (!predecessorIds?.trim()) return errors;

  // Parse and validate SI numbers
  const siNos = predecessorIds.split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id));
  
  // Check if all SI numbers exist
  const invalidSiNos = siNos.filter(siNo => 
    !tasks.find(t => !t.isDeleted && t.siNo === siNo)
  );
  
  if (invalidSiNos.length > 0) {
    errors.push(`Invalid SI numbers: ${invalidSiNos.join(', ')}`);
  }

  // Check for self-reference
  if (siNos.includes(task.siNo)) {
    errors.push('Task cannot depend on itself');
  }

  // Check for circular dependencies
  if (detectCircularDependency(tasks, task.id, predecessorIds)) {
    errors.push('Circular dependency detected');
  }

  // Check for ancestor dependencies
  const ancestors = findAncestors(tasks, task);
  const ancestorSiNos = ancestors.map(a => a.siNo);
  const ancestorDependencies = siNos.filter(siNo => ancestorSiNos.includes(siNo));
  
  if (ancestorDependencies.length > 0) {
    errors.push(`Task cannot depend on its ancestors: ${ancestorDependencies.join(', ')}`);
  }

  return errors;
}

/**
 * Finds all tasks that depend on the specified tasks
 * @param tasks All tasks in the project
 * @param taskSiNos Array of SI numbers to check dependencies for
 * @returns Array of dependent tasks
 */
export function findDependentTasks(tasks: Task[], taskSiNos: number[]): Task[] {
  return tasks.filter(task => 
    !task.isDeleted && 
    task.predecessorIds?.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id))
      .some(id => taskSiNos.includes(id))
  );
}

/**
 * Updates WBS numbers for all tasks based on their hierarchy
 * @param tasks All tasks in the project
 * @returns Updated list of tasks with correct WBS numbers
 */
export function updateWbsNumbers(tasks: Task[]): Task[] {
  // Create a copy of tasks that excludes deleted tasks
  const activeTasks = tasks.filter(t => !t.isDeleted);
  
  // Map to store the new WBS number for each task ID
  const wbsMap = new Map<string, string>();
  
  // Process level 0 tasks first (assign toplevel numbers 1, 2, 3, etc.)
  let level0Counter = 1;
  for (const task of activeTasks) {
    if (task.level === 0) {
      wbsMap.set(task.id, String(level0Counter++));
    }
  }
  
  // For each level 0 task, process its children recursively
  for (let i = 0; i < activeTasks.length; i++) {
    const task = activeTasks[i];
    
    // Skip if not a level 0 task
    if (task.level !== 0) continue;
    
    // Get its WBS number
    const parentWbs = wbsMap.get(task.id)!;
    
    // Find all direct children (tasks immediately following with level = 1)
    let childCounter = 1;
    for (let j = i + 1; j < activeTasks.length; j++) {
      const nextTask = activeTasks[j];
      
      // If we encounter another level 0 task, we're done with this parent's children
      if (nextTask.level === 0) break;
      
      // If this is a direct child of the current parent (level = parent.level + 1)
      if (nextTask.level === task.level + 1) {
        // Assign WBS number (parent.wbs.childCounter)
        const childWbs = `${parentWbs}.${childCounter++}`;
        wbsMap.set(nextTask.id, childWbs);
        
        // Process this child's children recursively
        processChildren(activeTasks, nextTask, j, childWbs, wbsMap);
      }
    }
  }
  
  // Update tasks with new WBS numbers
  return tasks.map(task => 
    task.isDeleted 
      ? task 
      : { ...task, wbsNo: wbsMap.get(task.id) || task.wbsNo }
  );
}

/**
 * Helper function to recursively process children of a task and assign WBS numbers
 */
function processChildren(
  tasks: Task[], 
  parentTask: Task, 
  parentIndex: number, 
  parentWbs: string,
  wbsMap: Map<string, string>
): void {
  // Track the current child's level (direct children of this parent)
  const childLevel = parentTask.level + 1;
  let childCounter = 1;
  
  // Start from the task after the parent
  for (let i = parentIndex + 1; i < tasks.length; i++) {
    const currentTask = tasks[i];
    
    // If we reach a task with level ≤ parent's level, we've exited this parent's scope
    if (currentTask.level <= parentTask.level) break;
    
    // If this is a direct child of the current parent
    if (currentTask.level === childLevel) {
      // Assign WBS number
      const childWbs = `${parentWbs}.${childCounter++}`;
      wbsMap.set(currentTask.id, childWbs);
      
      // Process this child's children recursively
      processChildren(tasks, currentTask, i, childWbs, wbsMap);
    }
  }
}

/**
 * Updates task levels for indentation (promotion)
 * @param tasks All tasks in the project
 * @param selectedIds Set of selected task IDs
 * @returns Updated list of tasks with adjusted levels
 */
export function updateTaskLevelsForIndent(tasks: Task[], selectedIds: Set<string>): Task[] {
  if (selectedIds.size === 0) return tasks;

  // Get visible tasks (not deleted)
  const visibleTasks = tasks.filter(t => !t.isDeleted);
  
  // Get selected tasks and their indices in the visible tasks array
  const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
  const selectedIndices = selectedTasks.map(task => 
    visibleTasks.findIndex(t => t.id === task.id)
  ).sort((a, b) => a - b);
  
  // Cannot indent if first task is selected (needs a parent)
  if (selectedIndices.includes(0)) {
    throw new Error("Cannot indent the first task (no parent available)");
  }
  
  // Check if selection is contiguous
  for (let i = 1; i < selectedIndices.length; i++) {
    if (selectedIndices[i] !== selectedIndices[i-1] + 1) {
      throw new Error("Selected tasks must be contiguous for indent operations");
    }
  }
  
  // Get the task above the first selected task (potential parent)
  const parentIndex = selectedIndices[0] - 1;
  const parentTask = visibleTasks[parentIndex];
  
  // Create a new array with updated levels
  const newTasks = [...tasks];
  
  // Find the indices in the full tasks array
  for (const task of selectedTasks) {
    const taskIndex = newTasks.findIndex(t => t.id === task.id);
    if (taskIndex !== -1) {
      // A task can only be indented to be one level deeper than its parent
      const maxAllowedLevel = parentTask.level + 1;
      newTasks[taskIndex] = {
        ...newTasks[taskIndex],
        level: Math.min(newTasks[taskIndex].level + 1, maxAllowedLevel)
      };
    }
  }
  
  // Update WBS numbers
  return updateWbsNumbers(newTasks);
}

/**
 * Updates task levels for outdentation (demotion)
 * @param tasks All tasks in the project
 * @param selectedIds Set of selected task IDs
 * @returns Updated list of tasks with adjusted levels
 */
export function updateTaskLevelsForOutdent(tasks: Task[], selectedIds: Set<string>): Task[] {
  if (selectedIds.size === 0) return tasks;

  // Get visible tasks (not deleted)
  const visibleTasks = tasks.filter(t => !t.isDeleted);
  
  // Get selected tasks and their indices in the visible tasks array
  const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
  const selectedIndices = selectedTasks.map(task => 
    visibleTasks.findIndex(t => t.id === task.id)
  ).sort((a, b) => a - b);
  
  // Check if any selected task is already at level 0
  const minLevel = Math.min(...selectedTasks.map(t => t.level));
  if (minLevel === 0) {
    throw new Error("Cannot outdent tasks at root level");
  }
  
  // Check if selection is contiguous
  for (let i = 1; i < selectedIndices.length; i++) {
    if (selectedIndices[i] !== selectedIndices[i-1] + 1) {
      throw new Error("Selected tasks must be contiguous for outdent operations");
    }
  }
  
  // Create a new array with updated levels
  const newTasks = [...tasks];
  
  // Find the indices in the full tasks array and update levels
  for (const task of selectedTasks) {
    const taskIndex = newTasks.findIndex(t => t.id === task.id);
    if (taskIndex !== -1) {
      newTasks[taskIndex] = {
        ...newTasks[taskIndex],
        level: Math.max(0, newTasks[taskIndex].level - 1)
      };
    }
  }
  
  // Update WBS numbers
  return updateWbsNumbers(newTasks);
}

/**
 * Updates SI numbers for all tasks after deletion
 * @param tasks All tasks in the project
 * @param deletedSiNos Array of SI numbers that were deleted
 * @returns Updated list of tasks with renumbered SI numbers
 */
export function updateSiNumbersAfterDeletion(tasks: Task[], deletedSiNos: number[]): Task[] {
  // Sort tasks by current SI number
  const sortedTasks = [...tasks].sort((a, b) => a.siNo - b.siNo);
  
  // Create a new array with updated SI numbers
  let nextSiNo = 1;
  return sortedTasks.map(task => {
    // Skip deleted tasks
    if (task.isDeleted || deletedSiNos.includes(task.siNo)) {
      return task;
    }
    
    // Update SI number
    const newTask = { ...task, siNo: nextSiNo++ };
    
    // Update predecessors to reflect new SI numbers
    if (newTask.predecessorIds) {
      const updatedPredecessors = newTask.predecessorIds
        .split(',')
        .map(id => {
          const predSiNo = parseInt(id.trim());
          if (isNaN(predSiNo)) return '';
          
          // If this predecessor was deleted, remove it
          if (deletedSiNos.includes(predSiNo)) return '';
          
          // Find the new SI number for this predecessor
          const predTask = sortedTasks.find(t => t.siNo === predSiNo);
          if (!predTask || predTask.isDeleted) return '';
          
          // Calculate new SI number based on position
          const predIndex = sortedTasks.findIndex(t => t.siNo === predSiNo);
          let newPredSiNo = predIndex + 1;
          
          // Adjust for deleted tasks before this predecessor
          const deletedBefore = deletedSiNos.filter(siNo => siNo < predSiNo).length;
          newPredSiNo -= deletedBefore;
          
          return String(newPredSiNo);
        })
        .filter(Boolean)
        .join(',');
      
      newTask.predecessorIds = updatedPredecessors || null;
    }
    
    return newTask;
  });
}

/**
 * Moves a task up within its siblings (tasks of same level within the same parent)
 * @param tasks All tasks in the project
 * @param taskId ID of the task to move up
 * @returns Updated list of tasks with adjusted positions
 */
export function moveTaskUp(tasks: Task[], taskId: string): Task[] {
  const taskIndex = tasks.findIndex(t => t.id === taskId && !t.isDeleted);
  if (taskIndex <= 0) return tasks; // Can't move up if first task or task not found
  
  const task = tasks[taskIndex];
  
  // Find all tasks at the same level with the same parent
  const siblings = findSiblingTasks(tasks, task);
  
  // Find the task's position within its siblings
  const siblingIndex = siblings.findIndex(s => s.id === taskId);
  
  // Can't move up if it's the first sibling
  if (siblingIndex <= 0) return tasks;
  
  const previousSibling = siblings[siblingIndex - 1];
  
  // Find the actual indices of the tasks in the complete task list
  const previousSiblingIndex = tasks.findIndex(t => t.id === previousSibling.id);
  
  // Get all children of the task that will move
  const taskChildren = findAllChildTasks(tasks, task);
  
  // Get all children of the previous sibling that will move
  const previousSiblingChildren = findAllChildTasks(tasks, previousSibling);
  
  // Create groups of tasks to move
  const taskGroup = [task, ...taskChildren];
  const prevTaskGroup = [previousSibling, ...previousSiblingChildren];
  
  // Save original SI numbers for each task
  const originalSiMap = new Map<string, number>();
  tasks.forEach(t => originalSiMap.set(t.id, t.siNo));
  
  // Create new array with swapped tasks
  let newTasks: Task[] = [...tasks];
  
  // Remove the tasks that will be moved
  newTasks = newTasks.filter(t => 
    !taskGroup.some(mt => mt.id === t.id) && 
    !prevTaskGroup.some(mt => mt.id === t.id)
  );
  
  // Determine insertion point - where the previous sibling was
  const insertIndex = previousSiblingIndex;
  
  // Insert tasks in new positions - current task group first, then previous sibling group
  newTasks = [
    ...newTasks.slice(0, insertIndex),
    ...taskGroup,
    ...prevTaskGroup,
    ...newTasks.slice(insertIndex)
  ];
  
  // Renumber SI numbers sequentially
  for (let i = 0; i < newTasks.length; i++) {
    newTasks[i] = {
      ...newTasks[i],
      siNo: i + 1
    };
  }
  
  // Update predecessor references
  newTasks = updatePredecessorsAfterMove(newTasks, originalSiMap);
  
  // Recalculate WBS numbers
  return updateWbsNumbers(newTasks);
}

/**
 * Moves a task down within its siblings (tasks of same level within the same parent)
 * @param tasks All tasks in the project
 * @param taskId ID of the task to move down
 * @returns Updated list of tasks with adjusted positions
 */
export function moveTaskDown(tasks: Task[], taskId: string): Task[] {
  const taskIndex = tasks.findIndex(t => t.id === taskId && !t.isDeleted);
  if (taskIndex < 0 || taskIndex >= tasks.length - 1) return tasks; // Can't move if last task or task not found
  
  const task = tasks[taskIndex];
  
  // Find all tasks at the same level with the same parent
  const siblings = findSiblingTasks(tasks, task);
  
  // Find the task's position within its siblings
  const siblingIndex = siblings.findIndex(s => s.id === taskId);
  
  // Can't move down if it's the last sibling
  if (siblingIndex >= siblings.length - 1) return tasks;
  
  const nextSibling = siblings[siblingIndex + 1];
  
  // Find the actual index of the next sibling in the complete task list
  const nextSiblingIndex = tasks.findIndex(t => t.id === nextSibling.id);
  
  // Get all children of the current task
  const taskChildren = findAllChildTasks(tasks, task);
  
  // Get all children of the next sibling
  const nextSiblingChildren = findAllChildTasks(tasks, nextSibling);
  
  // Create groups of tasks to move
  const taskGroup = [task, ...taskChildren];
  const nextTaskGroup = [nextSibling, ...nextSiblingChildren];
  
  // Save original SI numbers for each task
  const originalSiMap = new Map<string, number>();
  tasks.forEach(t => originalSiMap.set(t.id, t.siNo));
  
  // Create new array with swapped tasks
  let newTasks: Task[] = [...tasks];
  
  // Remove the tasks that will be moved
  newTasks = newTasks.filter(t => 
    !taskGroup.some(mt => mt.id === t.id) && 
    !nextTaskGroup.some(mt => mt.id === t.id)
  );
  
  // Determine insertion point - where the current task was
  const insertIndex = taskIndex;
  
  // Insert tasks in new positions - next sibling group first, then current task group
  newTasks = [
    ...newTasks.slice(0, insertIndex),
    ...nextTaskGroup,
    ...taskGroup,
    ...newTasks.slice(insertIndex)
  ];
  
  // Renumber SI numbers sequentially
  for (let i = 0; i < newTasks.length; i++) {
    newTasks[i] = {
      ...newTasks[i],
      siNo: i + 1
    };
  }
  
  // Update predecessor references
  newTasks = updatePredecessorsAfterMove(newTasks, originalSiMap);
  
  // Recalculate WBS numbers
  return updateWbsNumbers(newTasks);
}

/**
 * Updates predecessor references after tasks have been moved
 * @param tasks Updated tasks with new SI numbers
 * @param originalSiMap Map of original SI numbers by task ID
 * @returns Tasks with updated predecessor references
 */
export function updatePredecessorsAfterMove(
  tasks: Task[],
  originalSiMap: Map<string, number>
): Task[] {
  return tasks.map(task => {
    if (!task.predecessorIds) return task;

    // Map old SI numbers to new SI numbers
    const updatedPredecessorIds = task.predecessorIds
      .split(',')
      .map(siStr => {
        const siNo = parseInt(siStr.trim());
        if (isNaN(siNo)) return siStr;
        
        // Find the task that had this SI number originally
        const originalTask = Array.from(originalSiMap.entries())
          .find(([_, origSiNo]) => origSiNo === siNo);
        
        if (!originalTask) return siStr;
        
        // Get the new SI number for this task
        const [taskId] = originalTask;
        const newTask = tasks.find(t => t.id === taskId);
        
        return newTask ? String(newTask.siNo) : siStr;
      })
      .join(',');
    
    return {
      ...task,
      predecessorIds: updatedPredecessorIds
    };
  });
}

/**
 * Finds all sibling tasks (tasks at the same level with the same parent)
 * @param tasks All tasks in the project
 * @param task The target task
 * @returns Array of sibling tasks
 */
export function findSiblingTasks(tasks: Task[], task: Task): Task[] {
  if (task.level === 0) {
    // For level 0 tasks, all level 0 tasks are siblings
    return tasks.filter(t => t.level === 0 && !t.isDeleted);
  }
  
  // For other levels, find the parent first
  let parentTask: Task | undefined;
  
  // Iterate backwards from the task to find its parent
  const taskIndex = tasks.findIndex(t => t.id === task.id);
  for (let i = taskIndex - 1; i >= 0; i--) {
    if (tasks[i].level === task.level - 1) {
      parentTask = tasks[i];
      break;
    }
  }
  
  if (!parentTask) return [task]; // No parent found, return only the task itself
  
  // Now find all tasks that have the same parent (siblings)
  const siblings: Task[] = [];
  
  // First, find the range of all tasks under this parent
  let parentRange = {start: -1, end: tasks.length};
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].id === parentTask.id) {
      parentRange.start = i;
      break;
    }
  }
  
  // Find the end of parent's range (next task with same or lower level than parent)
  for (let i = parentRange.start + 1; i < tasks.length; i++) {
    if (tasks[i].level <= parentTask.level) {
      parentRange.end = i;
      break;
    }
  }
  
  // Now collect all direct children (level = parent.level + 1)
  for (let i = parentRange.start + 1; i < parentRange.end; i++) {
    if (tasks[i].level === task.level) {
      siblings.push(tasks[i]);
    }
  }
  
  // Filter out deleted tasks
  return siblings.filter(t => !t.isDeleted);
}

/**
 * Finds all child tasks of a given task (recursively)
 * @param tasks All tasks in the project
 * @param task The parent task
 * @returns Array of all child tasks
 */
export function findAllChildTasks(tasks: Task[], task: Task): Task[] {
  const taskIndex = tasks.findIndex(t => t.id === task.id);
  if (taskIndex === -1) return [];
  
  const children: Task[] = [];
  const taskLevel = task.level;
  
  // Look for child tasks (tasks with higher level that come after this task)
  for (let i = taskIndex + 1; i < tasks.length; i++) {
    const currentTask = tasks[i];
    if (currentTask.level <= taskLevel) {
      // Found a task at the same or lower level, which means we're out of the children
      break;
    }
    
    children.push(currentTask);
  }
  
  return children.filter(t => !t.isDeleted);
}

/**
 * Updates the isParent status of all tasks based on whether they have children
 * @param tasks All tasks in the project
 * @returns Updated list of tasks with isParent status
 */
export function updateParentStatus(tasks: Task[]): Task[] {
  // First build a map of tasks by their level
  const tasksByLevel: { [level: number]: Task[] } = {};
  
  tasks.filter(t => !t.isDeleted).forEach(task => {
    if (!tasksByLevel[task.level]) {
      tasksByLevel[task.level] = [];
    }
    tasksByLevel[task.level].push(task);
  });
  
  return tasks.map(task => {
    // Find if this task has any direct children (tasks with level = task.level + 1)
    // that come after this task in the hierarchy
    const taskIndex = tasks.findIndex(t => t.id === task.id);
    if (taskIndex === -1) return task;
    
    let hasDirectChildren = false;
    
    // Look for direct children (level = task.level + 1)
    for (let i = taskIndex + 1; i < tasks.length; i++) {
      const nextTask = tasks[i];
      
      // If we find a task with same or lower level, we've exited this task's scope
      if (nextTask.level <= task.level) break;
      
      // If we find a task with level = task.level + 1, this is a direct child
      if (nextTask.level === task.level + 1 && !nextTask.isDeleted) {
        hasDirectChildren = true;
        break;
      }
    }
    
    return {
      ...task,
      isParent: hasDirectChildren
    };
  });
}

/**
 * Detects circular dependencies in the task graph
 * @param tasks All tasks in the project
 * @param taskId ID of the task to check
 * @param predecessorIds Comma-separated string of predecessor SI numbers
 * @returns True if a circular dependency is detected, false otherwise
 */
export function detectCircularDependency(tasks: Task[], taskId: string, predecessorIds: string): boolean {
  if (!predecessorIds?.trim() || predecessorIds === '0') return false;
  
  const taskSiNo = tasks.find(t => t.id === taskId)?.siNo;
  if (!taskSiNo) return false;
  
  const visited = new Set<number>();
  const siNos = predecessorIds.split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id));

  function hasCycle(currentSiNo: number, path = new Set<number>()): boolean {
    // If we've seen this task in the current path, we have a cycle
    if (path.has(currentSiNo)) return true;
    
    // If we've already checked this task in another path and found no cycles, skip it
    if (visited.has(currentSiNo)) return false;
    
    // Add to current path and visited set
    path.add(currentSiNo);
    visited.add(currentSiNo);
    
    // If this is our original task, we've found a cycle
    if (currentSiNo === taskSiNo) return true;
    
    // Get the current task
    const currentTask = tasks.find(t => !t.isDeleted && t.siNo === currentSiNo);
    if (!currentTask?.predecessorIds || currentTask.predecessorIds === '0') return false;
    
    // Check all predecessors of this task
    const predSiNos = currentTask.predecessorIds.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));
    
    // If any predecessor creates a cycle, return true
    for (const predSiNo of predSiNos) {
      if (hasCycle(predSiNo, new Set(path))) return true;
    }
    
    return false;
  }
  
  // Check each predecessor for cycles
  return siNos.some(siNo => hasCycle(siNo));
}

/**
 * Calculates the schedule percentage based on today's date relative to task's start and end dates
 * @param startDate Task's scheduled start date
 * @param endDate Task's scheduled end date
 * @returns Schedule percentage (0-100)
 */
export function calculateSchedulePercentage(startDate: Date | null, endDate: Date | null): number {
  // If either date is missing, return 0
  if (!startDate || !endDate) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  // If task hasn't started yet
  if (today < start) return 0;

  // If task is completed or overdue
  if (today > end) return 100;

  // Calculate percentage based on elapsed time
  const totalDuration = end.getTime() - start.getTime();
  const elapsedDuration = today.getTime() - start.getTime();
  
  return Math.round((elapsedDuration / totalDuration) * 100);
}
