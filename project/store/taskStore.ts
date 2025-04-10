import { create } from 'zustand';
import { Task, TaskUpdate, STAGES, PRODUCTS } from '@/types/task';
import { 
  updateDependentTasks, 
  updateWbsNumbers, 
  updateSiNumbersAfterDeletion, 
  moveTaskUp, 
  moveTaskDown, 
  findAllChildTasks, 
  updateParentStatus 
} from '@/lib/taskUtils';
import { calculateDuration, calculateEndDate } from '@/lib/dateUtils';

interface TaskState {
  tasks: Task[];
  selectedIds: Set<string>;
  isSelecting: boolean;
  undoStack: Task[][];
  redoStack: Task[][];
  activeTaskId: string | null;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  addTaskAfter: (afterTaskId: string) => void;
  updateTask: (id: string, update: TaskUpdate) => void;
  deleteTask: (id: string) => void;
  bulkDeleteTasks: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  setSelecting: (isSelecting: boolean) => void;
  clearSelection: () => void;
  setActiveTask: (id: string | null) => void;
  toggleGoLive: (id: string) => void;
  toggleFinancialMilestone: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  assignStage: (taskId: string, stageId: string) => void;
  assignProduct: (taskId: string, productId: string) => void;
  updateIsParentStatus: (tasks: Task[]) => Task[];
  updateParentDates: (tasks: Task[]) => Task[];
  updateParentProgress: (tasks: Task[]) => Task[];
  undo: () => void;
  redo: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedIds: new Set(),
  isSelecting: false,
  undoStack: [],
  redoStack: [],
  activeTaskId: null,

  setTasks: (tasks) => {
    // Initialize default values for new fields
    const updatedTasks = tasks.map(task => ({
      ...task,
      progress: task.progress ?? (task.actualEndDate ? 100 : task.actualStartDate ? 50 : 0),
      view: task.view ?? 'External',
      actualDuration: task.actualDuration ?? (
        task.actualStartDate && task.actualEndDate 
          ? calculateDuration(task.actualStartDate, task.actualEndDate)
          : null
      ),
      predecessorIds: task.predecessorIds === '' ? '0' : task.predecessorIds
    }));
    
    // Calculate isParent status for each task
    const tasksWithParentStatus = get().updateIsParentStatus(updatedTasks);
    
    // Update parent task dates based on children
    const tasksWithUpdatedDates = get().updateParentDates(tasksWithParentStatus);
    
    // Update parent task progress based on children
    const tasksWithUpdatedProgress = get().updateParentProgress(tasksWithUpdatedDates);
    
    set({ tasks: updateWbsNumbers(tasksWithUpdatedProgress) });
  },

  addTask: (task) => {
    const { tasks, undoStack } = get();
    const newTasks = [...tasks, { 
      ...task, 
      goLive: false, 
      financialMilestone: false,
      isParent: false,
      predecessorIds: task.predecessorIds || '0' // Default to 0 if no predecessors
    }];
    
    // Update parent status for all tasks
    const tasksWithUpdatedParentStatus = updateParentStatus(newTasks);
    
    // Update parent task dates based on children
    const tasksWithUpdatedDates = get().updateParentDates(tasksWithUpdatedParentStatus);
    
    // Update parent task progress based on children
    const tasksWithUpdatedProgress = get().updateParentProgress(tasksWithUpdatedDates);
    
    set({
      tasks: updateWbsNumbers(tasksWithUpdatedProgress),
      undoStack: [...undoStack, tasks],
      redoStack: [],
      activeTaskId: task.id
    });
  },

  addTaskAfter: (afterTaskId) => {
    const { tasks, undoStack } = get();
    const afterTaskIndex = tasks.findIndex(t => t.id === afterTaskId);
    
    if (afterTaskIndex === -1) return;
    
    const afterTask = tasks[afterTaskIndex];
    const newSiNo = afterTask.siNo + 1;
    
    const newTask: Task = {
      id: crypto.randomUUID(),
      siNo: newSiNo,
      wbsNo: String(newSiNo),
      taskName: `<task${newSiNo}>`,
      predecessorIds: '0', // Default to 0
      level: afterTask.level,
      goLive: false,
      financialMilestone: false,
      startDate: null, // Changed from new Date() to null
      endDate: null,
      duration: 0, // Changed from 1 to 0 as default
      actualStartDate: null,
      actualEndDate: null,
      actualDuration: null,
      progress: 0,
      view: 'External',
      remarks: [],
      isParent: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      stageId: afterTask.level === 0 ? undefined : afterTask.stageId,
      productId: undefined,
      isDeleted: false // Add this field to match the Task interface
    };
    
    // Update SI numbers for all tasks after the insertion point
    const updatedTasksAfter = tasks.slice(afterTaskIndex + 1).map(task => ({
      ...task,
      siNo: task.siNo + 1,
      // Update predecessorIds to reflect new SI numbers
      predecessorIds: task.predecessorIds 
        ? task.predecessorIds === '0' 
          ? '0' 
          : task.predecessorIds
              .split(',')
              .map(id => {
                const predSiNo = parseInt(id.trim());
                return predSiNo >= newSiNo ? String(predSiNo + 1) : id;
              })
              .join(',')
        : '0'
    }));
    
    // Combine all tasks with the new one inserted
    const newTasks = [
      ...tasks.slice(0, afterTaskIndex + 1),
      newTask,
      ...updatedTasksAfter
    ];
    
    // Update parent status for all tasks
    const tasksWithUpdatedParentStatus = updateParentStatus(newTasks);
    
    // Update parent task dates based on children
    const tasksWithUpdatedDates = get().updateParentDates(tasksWithUpdatedParentStatus);
    
    // Update parent task progress based on children
    const tasksWithUpdatedProgress = get().updateParentProgress(tasksWithUpdatedDates);
    
    set({
      tasks: updateWbsNumbers(tasksWithUpdatedProgress),
      undoStack: [...undoStack, tasks],
      redoStack: [],
      activeTaskId: newTask.id // Set the new task as active
    });
  },

  updateTask: (id, update) => {
    const { tasks, undoStack } = get();
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const task = tasks[taskIndex];
    
    // Don't allow updating dates or progress for parent tasks
    if (task.isParent) {
      // Filter out date and progress fields for parent tasks
      const filteredUpdate: TaskUpdate = { ...update };
      delete filteredUpdate.startDate;
      delete filteredUpdate.endDate;
      delete filteredUpdate.duration;
      delete filteredUpdate.progress;
      delete filteredUpdate.actualStartDate;
      delete filteredUpdate.actualEndDate;
      delete filteredUpdate.actualDuration;
      
      // If the update is now empty, return
      if (Object.keys(filteredUpdate).length === 0) return;
      
      // Apply the filtered update
      const updatedTask = { 
        ...task, 
        ...filteredUpdate, 
        updatedAt: new Date() 
      };
      
      let newTasks = [...tasks];
      newTasks[taskIndex] = updatedTask;
      
      // Update parent statuses in the entire task tree
      newTasks = updateParentStatus(newTasks);
      
      // Update parent dates and progress
      newTasks = get().updateParentDates(newTasks);
      newTasks = get().updateParentProgress(newTasks);
      
      set({
        tasks: updateWbsNumbers(newTasks),
        undoStack: [...undoStack, tasks],
        redoStack: []
      });
      return;
    }

    // Handle special cases for the new fields
    const processedUpdate = { ...update };
    
    // If predecessorIds is empty string, set to '0'
    if (processedUpdate.predecessorIds === '') {
      processedUpdate.predecessorIds = '0';
    }
    
    // If setting actual end date, set progress to 100%
    if (update.actualEndDate && !update.progress) {
      processedUpdate.progress = 100;
    }
    
    // If setting actual start date and progress is 0, set to 50%
    if (update.actualStartDate && tasks[taskIndex].progress === 0 && !update.progress) {
      processedUpdate.progress = 50;
    }
    
    // Calculate actual duration if both actual dates are present
    if ((update.actualStartDate || tasks[taskIndex].actualStartDate) && 
        (update.actualEndDate || tasks[taskIndex].actualEndDate)) {
      const startDate = update.actualStartDate || tasks[taskIndex].actualStartDate;
      const endDate = update.actualEndDate || tasks[taskIndex].actualEndDate;
      
      if (startDate && endDate) {
        processedUpdate.actualDuration = calculateDuration(startDate, endDate);
      }
    }

    const updatedTask = { 
      ...tasks[taskIndex], 
      ...processedUpdate, 
      updatedAt: new Date() 
    };
    
    let newTasks = updateDependentTasks(tasks, updatedTask);
    
    // Update parent statuses in the entire task tree
    newTasks = updateParentStatus(newTasks);
    
    // Update parent task dates based on children
    newTasks = get().updateParentDates(newTasks);
    
    // Update parent task progress based on children
    newTasks = get().updateParentProgress(newTasks);

    set({
      tasks: updateWbsNumbers(newTasks),
      undoStack: [...undoStack, tasks],
      redoStack: []
    });
  },

  deleteTask: (id) => {
    const { tasks, undoStack, activeTaskId, selectedIds } = get();
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;
    
    // Create a new task list with the task marked as deleted
    let newTasks = [...tasks];
    const taskIndex = newTasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;
    
    // Mark task as deleted instead of removing it
    newTasks[taskIndex] = { ...newTasks[taskIndex], isDeleted: true };
    
    // Mark all children as deleted
    const childTasks = findAllChildTasks(newTasks, taskToDelete);
    childTasks.forEach(childTask => {
      const childIndex = newTasks.findIndex(t => t.id === childTask.id);
      if (childIndex !== -1) {
        newTasks[childIndex] = { ...newTasks[childIndex], isDeleted: true };
      }
    });
    
    // Update SI numbers for all tasks after deletion
    const deletedSiNos = [taskToDelete.siNo, ...childTasks.map(t => t.siNo)];
    newTasks = updateSiNumbersAfterDeletion(newTasks, deletedSiNos);
    
    // Update parent statuses in the entire task tree
    newTasks = updateParentStatus(newTasks);
    
    // Update parent dates and progress
    newTasks = get().updateParentDates(newTasks);
    newTasks = get().updateParentProgress(newTasks);
    
    // Remove deleted tasks from selection
    const newSelection = new Set(selectedIds);
    newSelection.delete(id);
    childTasks.forEach(child => newSelection.delete(child.id));
    
    set({
      tasks: updateWbsNumbers(newTasks),
      undoStack: [...undoStack, tasks],
      redoStack: [],
      activeTaskId: activeTaskId === id ? null : activeTaskId,
      selectedIds: newSelection
    });
  },

  bulkDeleteTasks: (ids) => {
    const { tasks, undoStack, activeTaskId, selectedIds } = get();
    
    // First, find all tasks to delete (including children of selected tasks)
    const tasksToDelete = tasks.filter(t => ids.includes(t.id));
    
    // Get all child tasks of selected tasks
    let allTasksToDelete = [...tasksToDelete];
    tasksToDelete.forEach(task => {
      const childTasks = findAllChildTasks(tasks, task);
      allTasksToDelete = [...allTasksToDelete, ...childTasks];
    });
    
    // Create a unique set of task IDs to delete
    const uniqueTaskIdsToDelete = new Set(allTasksToDelete.map(t => t.id));
    
    // Create a new task list with tasks marked as deleted
    let newTasks = [...tasks];
    uniqueTaskIdsToDelete.forEach(taskId => {
      const taskIndex = newTasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        newTasks[taskIndex] = { ...newTasks[taskIndex], isDeleted: true };
      }
    });
    
    // Update SI numbers for all tasks after deletion
    const deletedSiNos = allTasksToDelete.map(t => t.siNo);
    newTasks = updateSiNumbersAfterDeletion(newTasks, deletedSiNos);
    
    // Update parent statuses in the entire task tree
    newTasks = updateParentStatus(newTasks);
    
    // Update parent dates and progress
    newTasks = get().updateParentDates(newTasks);
    newTasks = get().updateParentProgress(newTasks);
    
    // Remove deleted tasks from selection
    const newSelection = new Set<string>();
    selectedIds.forEach(id => {
      if (!uniqueTaskIdsToDelete.has(id)) {
        newSelection.add(id);
      }
    });
    
    set({
      tasks: updateWbsNumbers(newTasks),
      undoStack: [...undoStack, tasks],
      redoStack: [],
      activeTaskId: uniqueTaskIdsToDelete.has(activeTaskId || '') ? null : activeTaskId,
      selectedIds: newSelection,
      isSelecting: newSelection.size > 0 // Keep selecting mode active if tasks remain selected
    });
  },

  toggleSelection: (id) => {
    const { selectedIds, tasks } = get();
    const newSelection = new Set(selectedIds);
    const task = tasks.find(t => t.id === id);
    
    if (!task) return;
    
    // If task is already selected, deselect it and its children
    if (newSelection.has(id)) {
      newSelection.delete(id);
      
      // Find and deselect all child tasks
      const childTasks = findAllChildTasks(tasks, task);
      childTasks.forEach(childTask => {
        newSelection.delete(childTask.id);
      });
    } else {
      // Select the task
      newSelection.add(id);
      
      // Find and select all child tasks
      const childTasks = findAllChildTasks(tasks, task);
      childTasks.forEach(childTask => {
        newSelection.add(childTask.id);
      });
    }
    
    set({ selectedIds: newSelection });
  },

  setSelecting: (isSelecting) => set({ isSelecting }),
  clearSelection: () => set({ selectedIds: new Set() }),
  setActiveTask: (id) => set({ activeTaskId: id }),

  toggleGoLive: (id) => {
    const { tasks, undoStack } = get();
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const updatedTask = { 
      ...tasks[taskIndex],
      goLive: !tasks[taskIndex].goLive,
      updatedAt: new Date()
    };

    const newTasks = [...tasks];
    newTasks[taskIndex] = updatedTask;

    set({
      tasks: newTasks,
      undoStack: [...undoStack, tasks],
      redoStack: []
    });
  },

  toggleFinancialMilestone: (id) => {
    const { tasks, undoStack } = get();
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const updatedTask = { 
      ...tasks[taskIndex],
      financialMilestone: !tasks[taskIndex].financialMilestone,
      updatedAt: new Date()
    };

    const newTasks = [...tasks];
    newTasks[taskIndex] = updatedTask;

    set({
      tasks: newTasks,
      undoStack: [...undoStack, tasks],
      redoStack: []
    });
  },

  moveUp: (id) => {
    const { tasks, undoStack } = get();
    const newTasks = moveTaskUp(tasks, id);
    
    // Update parent status for all tasks
    const tasksWithUpdatedParentStatus = updateParentStatus(newTasks);
    
    set({
      tasks: tasksWithUpdatedParentStatus,
      undoStack: [...undoStack, tasks],
      redoStack: []
    });
  },

  moveDown: (id) => {
    const { tasks, undoStack } = get();
    const newTasks = moveTaskDown(tasks, id);
    
    // Update parent status for all tasks
    const tasksWithUpdatedParentStatus = updateParentStatus(newTasks);
    
    set({
      tasks: tasksWithUpdatedParentStatus,
      undoStack: [...undoStack, tasks],
      redoStack: []
    });
  },

  assignStage: (taskId, stageId) => {
    const { tasks, undoStack } = get();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Only allow assigning stages to level 0 tasks
    if (task.level !== 0) return;
    
    const updatedTask = { ...task, stageId, updatedAt: new Date() };
    
    // Update the task and all its children with the new stage
    let newTasks = [...tasks];
    const taskIndex = newTasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      newTasks[taskIndex] = updatedTask;
      
      // Propagate stage to all children
      const childTasks = findAllChildTasks(newTasks, updatedTask);
      childTasks.forEach(childTask => {
        const childIndex = newTasks.findIndex(t => t.id === childTask.id);
        if (childIndex !== -1) {
          newTasks[childIndex] = { 
            ...newTasks[childIndex], 
            stageId,
            updatedAt: new Date()
          };
        }
      });
    }
    
    set({
      tasks: newTasks,
      undoStack: [...undoStack, tasks],
      redoStack: []
    });
  },

  assignProduct: (taskId, productId) => {
    const { tasks, undoStack } = get();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Only allow assigning products to leaf nodes (non-parent tasks)
    if (task.isParent) return;
    
    const updatedTask = { ...task, productId, updatedAt: new Date() };
    
    // Update the task with the new product
    let newTasks = [...tasks];
    const taskIndex = newTasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      newTasks[taskIndex] = updatedTask;
    }
    
    set({
      tasks: newTasks,
      undoStack: [...undoStack, tasks],
      redoStack: []
    });
  },

  updateIsParentStatus: (tasks) => {
    return updateParentStatus(tasks);
  },
  
  updateParentDates: (tasks) => {
    // Function to find direct children of a task
    const findDirectChildren = (parentTask: Task, allTasks: Task[]): Task[] => {
      return allTasks.filter(t => 
        !t.isDeleted && 
        t.level === parentTask.level + 1 && 
        t.wbsNo.startsWith(parentTask.wbsNo + '.')
      );
    };
    
    // Create a copy of the tasks array to work with
    let updatedTasks = [...tasks];
    
    // Get tasks sorted by level in descending order (bottom-up)
    const tasksByLevel = [...updatedTasks]
      .filter(t => !t.isDeleted)
      .sort((a, b) => b.level - a.level);
    
    // Process parents from bottom level up
    for (const task of tasksByLevel) {
      if (task.isParent) {
        const children = findDirectChildren(task, updatedTasks)
          .filter(t => !t.isDeleted);
        
        if (children.length > 0) {
          // Get valid start dates (non-null)
          const validStartDates = children
            .filter(c => c.startDate !== null)
            .map(c => c.startDate as Date);
          
          // Get valid end dates (non-null)
          const validEndDates = children
            .filter(c => c.endDate !== null)
            .map(c => c.endDate as Date);
          
          // Get valid actual start dates (non-null)
          const validActualStartDates = children
            .filter(c => c.actualStartDate !== null)
            .map(c => c.actualStartDate as Date);
            
          // Get valid actual end dates (non-null)
          const validActualEndDates = children
            .filter(c => c.actualEndDate !== null)
            .map(c => c.actualEndDate as Date);
          
          // Calculate new dates for the parent
          let newStartDate = null;
          let newEndDate = null;
          let newActualStartDate = null;
          let newActualEndDate = null;
          
          // Min of all children start dates
          if (validStartDates.length > 0) {
            newStartDate = new Date(Math.min(...validStartDates.map(d => d.getTime())));
          }
          
          // Max of all children end dates
          if (validEndDates.length > 0) {
            newEndDate = new Date(Math.max(...validEndDates.map(d => d.getTime())));
          }
          
          // Min of all children actual start dates
          if (validActualStartDates.length > 0) {
            newActualStartDate = new Date(Math.min(...validActualStartDates.map(d => d.getTime())));
          }
          
          // Max of all children actual end dates
          if (validActualEndDates.length > 0) {
            newActualEndDate = new Date(Math.max(...validActualEndDates.map(d => d.getTime())));
          }
          
          // Update the parent task
          const parentIndex = updatedTasks.findIndex(t => t.id === task.id);
          if (parentIndex !== -1) {
            updatedTasks[parentIndex] = {
              ...updatedTasks[parentIndex],
              startDate: newStartDate,
              endDate: newEndDate,
              duration: (newStartDate && newEndDate) 
                ? calculateDuration(newStartDate, newEndDate) 
                : updatedTasks[parentIndex].duration,
              actualStartDate: newActualStartDate,
              actualEndDate: newActualEndDate,
              actualDuration: (newActualStartDate && newActualEndDate)
                ? calculateDuration(newActualStartDate, newActualEndDate)
                : updatedTasks[parentIndex].actualDuration,
              updatedAt: new Date()
            };
          }
        }
      }
    }
    
    return updatedTasks;
  },
  
  updateParentProgress: (tasks) => {
    // Function to find direct children of a task
    const findDirectChildren = (parentTask: Task, allTasks: Task[]): Task[] => {
      return allTasks.filter(t => 
        !t.isDeleted && 
        t.level === parentTask.level + 1 && 
        t.wbsNo.startsWith(parentTask.wbsNo + '.')
      );
    };
    
    // Create a copy of the tasks array to work with
    let updatedTasks = [...tasks];
    
    // Get tasks sorted by level in descending order (bottom-up)
    const tasksByLevel = [...updatedTasks]
      .filter(t => !t.isDeleted && t.isParent)
      .sort((a, b) => b.level - a.level);
    
    // Process parents from bottom level up
    for (const task of tasksByLevel) {
      const children = findDirectChildren(task, updatedTasks)
        .filter(t => !t.isDeleted);
      
      if (children.length > 0) {
        // Calculate the average progress of direct children
        // Explicitly convert progress values to numbers to avoid string concatenation
        const totalProgress = children.reduce((sum, child) => {
          // Ensure progress is treated as a float
          const childProgress = typeof child.progress === 'string' 
            ? parseFloat(child.progress) 
            : (Number(child.progress) || 0);
          
          return sum + childProgress;
        }, 0);
        
        // Calculate average as a float and round to one decimal place
        const avgProgress = Math.round((totalProgress / children.length) * 10) / 10;
        
        // Ensure avgProgress is a valid number between 0-100
        const validProgress = isNaN(avgProgress) ? 0 : Math.min(Math.max(avgProgress, 0), 100);
        
        // Update the parent task
        const parentIndex = updatedTasks.findIndex(t => t.id === task.id);
        if (parentIndex !== -1) {
          updatedTasks[parentIndex] = {
            ...updatedTasks[parentIndex],
            progress: validProgress,
            updatedAt: new Date()
          };
        }
      }
    }
    
    return updatedTasks;
  },

  undo: () => {
    const { undoStack, redoStack, tasks } = get();
    if (undoStack.length === 0) return;
    
    const prevState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, undoStack.length - 1);
    
    set({
      tasks: prevState,
      undoStack: newUndoStack,
      redoStack: [tasks, ...redoStack]
    });
  },

  redo: () => {
    const { redoStack, undoStack, tasks } = get();
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[0];
    const newRedoStack = redoStack.slice(1);
    
    set({
      tasks: nextState,
      undoStack: [...undoStack, tasks],
      redoStack: newRedoStack
    });
  }
}));

// Helper function to find all child tasks of a given task
function findChildTasks(tasks: Task[], parentTask: Task): Task[] {
  const taskIndex = tasks.findIndex(t => t.id === parentTask.id);
  if (taskIndex === -1) return [];
  
  const childTasks: Task[] = [];
  const parentLevel = parentTask.level;
  
  // Look at all tasks after the parent
  for (let i = taskIndex + 1; i < tasks.length; i++) {
    const currentTask = tasks[i];
    
    // If we encounter a task with level <= parentLevel, we've moved out of the children
    if (currentTask.level <= parentLevel) {
      break;
    }
    
    // This is a child or descendant of the parent
    if (currentTask.level > parentLevel) {
       childTasks.push(currentTask);
    }
  }
  
  return childTasks;
}