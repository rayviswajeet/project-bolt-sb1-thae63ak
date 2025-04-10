'use client';

import { useEffect, useState, useRef } from 'react';
import { Task, Remark, STAGES, PRODUCTS } from '@/types/task';
import { useTaskStore } from '@/store/taskStore';
import { List, AutoSizer } from 'react-virtualized';
import { Plus, CheckSquare, Trash2, Undo, Redo, ChevronRight, ChevronLeft, Eye, MessageSquarePlus, Download, FileSpreadsheet, View, Star, CircleArrowUp, CircleArrowDown, Layers, Save, FileCheck, ArrowDownToLine, FlagTriangleRight, Import, Snowflake, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DeleteDialog from '@/components/DeleteDialog';
import { updateTaskLevelsForIndent, updateTaskLevelsForOutdent, validatePredecessors, validateTaskDates, getMaxPredecessorEndDate, calculateSchedulePercentage } from '@/lib/taskUtils';
import { ResizableTable, ResizableHeader } from '@/components/ui/resizable-table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format, addDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import ResourceCell from '@/components/ResourceCell';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import RemarksModal from '@/components/modals/RemarksModal';
import { utils as xlsxUtils, writeFile as xlsxWriteFile } from 'xlsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { createTemplate, saveTemplate, loadTemplatesFromStorage, convertTemplateTasks, Template } from '@/lib/templateUtils';
import SaveTemplateModal from '@/components/modals/SaveTemplateModal';
import * as dateUtils from '@/lib/dateUtils';

interface TaskTableProps {
  initialTasks: Task[];
}

export default function TaskTable({ initialTasks }: TaskTableProps) {
  const {
    tasks,
    setTasks,
    addTask,
    addTaskAfter,
    updateTask,
    bulkDeleteTasks,
    isSelecting,
    setSelecting,
    selectedIds,
    toggleSelection, 
    clearSelection,
    activeTaskId,
    setActiveTask,
    toggleGoLive,
    toggleFinancialMilestone,
    moveUp,
    moveDown,
    undo,
    redo,
    assignStage,
    assignProduct
  } = useTaskStore();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingField, setEditingField] = useState<{ taskId: string, field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [selectedTaskForRemarks, setSelectedTaskForRemarks] = useState<Task | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [frozenColumns, setFrozenColumns] = useState(false);
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  
  // Fixed task column width - no longer resizable
  const taskColumnWidth = 250;

  // Filter out deleted tasks for display
  const visibleTasks = tasks.filter(task => !task.isDeleted);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks, setTasks]);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      const task = tasks.find(t => t.id === editingField.taskId);
      if (!task) return;

      if (editingField.field === 'taskName') {
        setEditValue(task.taskName || `<task${task.siNo}>`);
        inputRef.current.select();
      } else if (editingField.field === 'progress') {
        setEditValue(String(task.progress || 0));
        inputRef.current.select();
      } else {
        setEditValue(String(task[editingField.field as keyof Task] || ''));
        inputRef.current.select();
      }
    }
  }, [editingField, tasks]);

  // Load templates on component mount
  useEffect(() => {
    setTemplates(loadTemplatesFromStorage());
  }, []);

  // Add useEffect for keyboard navigation
  useEffect(() => {
    // Function to handle keyboard events
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process if we're not in selection mode and not editing a field
      if (isSelecting || editingField) return;
      
      // Get the visible tasks (not deleted)
      const activeIndex = activeTaskId ? visibleTasks.findIndex(t => t.id === activeTaskId) : -1;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault(); // Prevent page scrolling
        
        // If no active task or at the end, select the first task
        if (activeIndex === -1 || activeIndex === visibleTasks.length - 1) {
          if (visibleTasks.length > 0) {
            setActiveTask(visibleTasks[0].id);
            scrollToTask(visibleTasks[0].id);
          }
        } else {
          // Select the next task
          const nextTask = visibleTasks[activeIndex + 1];
          setActiveTask(nextTask.id);
          scrollToTask(nextTask.id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); // Prevent page scrolling
        
        // If no active task or at the beginning, select the last task
        if (activeIndex === -1 || activeIndex === 0) {
          if (visibleTasks.length > 0) {
            setActiveTask(visibleTasks[visibleTasks.length - 1].id);
            scrollToTask(visibleTasks[visibleTasks.length - 1].id);
          }
        } else {
          // Select the previous task
          const prevTask = visibleTasks[activeIndex - 1];
          setActiveTask(prevTask.id);
          scrollToTask(prevTask.id);
        }
      }
    };

    // Add event listener for keyboard navigation
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visibleTasks, activeTaskId, isSelecting, editingField]);

  // Add a function to scroll to the selected task
  const scrollToTask = (taskId: string) => {
    // Find the task row element
    const taskRow = document.getElementById(`task-row-${taskId}`);
    if (taskRow) {
      // Scroll the task into view, smoothly centering it if possible
      taskRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleAddTask = () => {
    // If there's an active task, add a task after it with the same level
    if (activeTaskId) {
      const activeTask = visibleTasks.find(t => t.id === activeTaskId);
      if (activeTask) {
        addTaskAfter(activeTaskId);
        return;
      }
    }

    // Otherwise, add a task at the end
    const lastTask = visibleTasks[visibleTasks.length - 1];
    const newSiNo = lastTask ? lastTask.siNo + 1 : 1;
    const newTask: Task = {
      id: crypto.randomUUID(),
      siNo: newSiNo,
      wbsNo: String(newSiNo),
      taskName: `<task${newSiNo}>`,
      predecessorIds: lastTask ? String(lastTask.siNo) : null,
      level: 0,
      goLive: false,
      financialMilestone: false,
      startDate: new Date(),
      endDate: null,
      duration: null,
      actualStartDate: null,
      actualEndDate: null,
      actualDuration: null,
      progress: 0,
      view: 'External',
      remarks: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    addTask(newTask);
    setActiveTask(newTask.id);
  };

  const handleDemote = () => {
    const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({
        title: "No Tasks Selected",
        description: "Please select tasks to demote",
        variant: "default"
      });
      return;
    }

    try {
      // Pass the full tasks array but only operate on visible tasks
      const updatedTasks = updateTaskLevelsForIndent(tasks, selectedIds);
      setTasks(updatedTasks);
      
      toast({
        title: "Tasks Demoted",
        description: `Successfully demoted ${selectedTasks.length} task(s)`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Cannot Demote",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handlePromote = () => {
    const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({
        title: "No Tasks Selected",
        description: "Please select tasks to promote",
        variant: "default"
      });
      return;
    }

    try {
      // Pass the full tasks array but only operate on visible tasks
      const updatedTasks = updateTaskLevelsForOutdent(tasks, selectedIds);
      setTasks(updatedTasks);
      
      toast({
        title: "Tasks Promoted",
        description: `Successfully promoted ${selectedTasks.length} task(s)`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Cannot Promote",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handleDelete = () => {
    const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({
        title: "No Tasks Selected",
        description: "Please select tasks to delete",
        variant: "default"
      });
      return;
    }

    // Check for dependencies
    const hasDependencies = selectedTasks.some(task => 
      visibleTasks.some(t => 
        !selectedIds.has(t.id) && 
        t.predecessorIds?.split(',')
          .map(id => parseInt(id.trim()))
          .filter(id => !isNaN(id))
          .includes(task.siNo)
      )
    );

    if (hasDependencies) {
      setShowDeleteDialog(true);
    } else {
      // No dependencies, can delete directly
      const taskIds = selectedTasks.map(task => task.id);
      bulkDeleteTasks(taskIds);
      
      toast({
        title: "Tasks Deleted",
        description: `Successfully deleted ${taskIds.length} task(s)`,
        variant: "default"
      });
      
      clearSelection();
    }
  };

  const handleMarkGoLive = () => {
    if (!activeTaskId) {
      toast({
        title: "No Task Selected",
        description: "Please select a task to mark as Go-live",
        variant: "default"
      });
      return;
    }

    toggleGoLive(activeTaskId);
    toast({
      title: "Go-live Status Updated",
      description: "Task Go-live status has been updated",
      variant: "default"
    });
  };

  const handleMarkFinancialMilestone = () => {
    if (!activeTaskId) {
      toast({
        title: "No Task Selected",
        description: "Please select a task to mark as Financial Milestone",
        variant: "default"
      });
      return;
    }

    toggleFinancialMilestone(activeTaskId);
    toast({
      title: "Financial Milestone Status Updated",
      description: "Task Financial Milestone status has been updated",
      variant: "default"
    });
  };

  const handleMoveUp = () => {
    if (!activeTaskId) {
      toast({
        title: "No Task Selected",
        description: "Please select a task to move up",
        variant: "default"
      });
      return;
    }

    moveUp(activeTaskId);
    toast({
      title: "Task Moved Up",
      description: "Task has been moved up successfully",
      variant: "default"
    });
  };

  const handleMoveDown = () => {
    if (!activeTaskId) {
      toast({
        title: "No Task Selected",
        description: "Please select a task to move down",
        variant: "default"
      });
      return;
    }

    moveDown(activeTaskId);
    toast({
      title: "Task Moved Down",
      description: "Task has been moved down successfully",
      variant: "default"
    });
  };

  const handleAssignStage = (stageId: string) => {
    if (!activeTaskId) {
      toast({
        title: "No Task Selected",
        description: "Please select a task to assign stage",
        variant: "default"
      });
      return;
    }

    const activeTask = tasks.find(t => t.id === activeTaskId);
    if (!activeTask) return;

    if (activeTask.level !== 0) {
      toast({
        title: "Invalid Task Level",
        description: "Stage can only be assigned to level 0 tasks",
        variant: "destructive"
      });
      return;
    }

    assignStage(activeTaskId, stageId);
    toast({
      title: "Stage Assigned",
      description: "Stage has been assigned to task and its children",
      variant: "default"
    });
  };

  const handleAssignProduct = (taskId: string, productId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.isParent) {
      toast({
        title: "Cannot Assign Product",
        description: "Products can only be assigned to leaf tasks",
        variant: "destructive"
      });
      return;
    }

    assignProduct(taskId, productId);
  };

  // Task Row Functions
  const calculateEndDate = (startDate: Date, duration: number): Date => {
    if (!startDate || !duration) return new Date();
    // This now automatically respects holiday exclusions from dateUtils
    return dateUtils.calculateEndDate(startDate, duration);
  };

  const calculateDuration = (startDate: Date, endDate: Date): number => {
    if (!startDate || !endDate) return 0;
    // This now automatically respects holiday exclusions from dateUtils
    return dateUtils.calculateDuration(startDate, endDate);
  };

  const detectCircularDependency = (task: Task, predecessorIds: string): boolean => {
    if (!predecessorIds?.trim()) return false;
    
    const visited = new Set<number>();
    const siNos = predecessorIds.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));
    
    const hasCycle = (currentSiNo: number, path = new Set<number>()): boolean => {
      if (path.has(currentSiNo)) return true;
      if (visited.has(currentSiNo)) return false;
      
      path.add(currentSiNo);
      visited.add(currentSiNo);
      
      if (currentSiNo === task.siNo) return true;
      
      const currentTask = tasks.find(t => t.siNo === currentSiNo);
      if (!currentTask?.predecessorIds) return false;
      
      const predSiNos = currentTask.predecessorIds.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
      
      return predSiNos.some(siNo => hasCycle(siNo, new Set(path)));
    };
    
    return siNos.some(siNo => hasCycle(siNo));
  };

  const getTaskStatus = (task: Task): 'Not Started' | 'In Progress' | 'Completed' | 'Delayed' => {
    const today = new Date();
    
    if (task.actualEndDate) {
      return task.actualEndDate > (task.endDate || today) ? 'Delayed' : 'Completed';
    }
    
    if (task.actualStartDate) {
      return 'In Progress';
    }
    
    if (task.endDate && task.endDate < today) {
      return 'Delayed';
    }
    
    return 'Not Started';
  };

  const handleDoubleClick = (taskId: string, field: string, value: any) => {
    if (field.includes('Date')) return;
    if (field === 'view') return; // View is handled separately with dropdown
    setEditingField({ taskId, field });
    setEditValue(String(value || ''));
  };

  const validateUpdate = (task: Task, field: string, value: any) => {
    if (field === 'predecessorIds' && value) {
      // Allow "0" as a valid value for predecessorIds (task is independent)
      if (value.trim() === '0') {
        return;
      }
      
      // Use the validatePredecessors function from taskUtils
      const errors = validatePredecessors(task, value, tasks);
      if (errors.length > 0) {
        throw new Error(errors[0]); // Throw the first error
      }
    }

    if (field === 'duration') {
      const duration = parseInt(value);
      if (isNaN(duration) || duration < 0) {
        throw new Error('Duration must be a positive number');
      }
    }

    if (field === 'progress') {
      const progress = parseFloat(value);
      if (isNaN(progress) || progress < 0 || progress > 100) {
        throw new Error('Progress must be between 0 and 100');
      }
    }

    if (field === 'taskName' && !value.trim()) {
      throw new Error('Task name cannot be empty');
    }
  };

  const handleBlur = () => {
    if (!editingField) return;

    const task = tasks.find(t => t.id === editingField.taskId);
    if (!task) {
      setEditingField(null);
      return;
    }

    try {
      let value = editValue.trim();
      if (editingField.field === 'taskName' && !value) {
        value = `<task${task.siNo}>`;
      }

      validateUpdate(task, editingField.field, value);

      if (value !== String(task[editingField.field as keyof Task] || '')) {
        const updates: any = { [editingField.field]: value };
        
        // If updating predecessors, check if we need to adjust dates
        if (editingField.field === 'predecessorIds') {
          const maxPredEndDate = getMaxPredecessorEndDate(tasks, value);
          if (maxPredEndDate && (!task.startDate || task.startDate <= maxPredEndDate)) {
            const newStartDate = addDays(maxPredEndDate, 1);
            updates.startDate = newStartDate;
            
            if (task.duration) {
              updates.endDate = calculateEndDate(newStartDate, task.duration);
            }
          }
        }
        
        // If updating duration, recalculate end date
        if (editingField.field === 'duration' && task.startDate) {
          const duration = parseInt(value);
          if (!isNaN(duration)) {
            updates.endDate = calculateEndDate(task.startDate, duration);
          }
        }

        // If updating progress, handle special cases
        if (editingField.field === 'progress') {
          const progress = parseFloat(value);
          if (!isNaN(progress)) {
            // Ensure progress is between 0 and 100
            updates.progress = Math.min(Math.max(progress, 0), 100);
            
            // If progress is 100%, set actual end date if not already set
            if (progress === 100 && !task.actualEndDate && task.actualStartDate) {
              updates.actualEndDate = new Date();
              // Calculate actual duration
              updates.actualDuration = calculateDuration(task.actualStartDate, updates.actualEndDate);
            }
          }
        }

        const errors = validateTaskDates(updates, tasks);
        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }

        updateTask(task.id, updates);
      }
    } catch (error) {
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : 'Invalid input',
        variant: "destructive"
      });
      if (editingField.field === 'taskName') {
        setEditValue(task.taskName || '');
      }
    }
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  const handleDateSelect = (taskId: string, field: keyof Task, date: Date | null) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Don't allow editing dates for parent tasks
    if (task.isParent) return;

    try {
      const updates: Partial<Task> = { [field]: date };
      
      if (date === null) {
        // If clearing actual end date, reset progress and actual duration
        if (field === 'actualEndDate') {
          updates.progress = task.progress === 100 ? 0 : task.progress; // Only reset if it was 100%
          updates.actualDuration = null;
        }
        // Apply the update
        updateTask(task.id, updates);
        return;
      }
      
      // Normalize dates by setting hours to 0 for date-only comparison
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if actual dates are not in the future
      if ((field === 'actualStartDate' || field === 'actualEndDate') && normalizedDate > today) {
        throw new Error(`${field === 'actualStartDate' ? 'Actual start' : 'Actual end'} date cannot be in the future`);
      }
      
      // Different handling based on which date field is being updated
      if (field === 'startDate') {
        // If duration is set, calculate end date
        if (task.duration && task.duration > 0) {
          updates.endDate = calculateEndDate(normalizedDate, task.duration);
        }
      } else if (field === 'endDate') {
        // If start date is set, calculate duration
        if (task.startDate) {
          if (normalizedDate < task.startDate) {
            throw new Error('End date must be on or after start date');
          }
          updates.duration = calculateDuration(task.startDate, normalizedDate);
        }
      } else if (field === 'actualStartDate') {
        if (task.actualEndDate) {
          if (normalizedDate > task.actualEndDate) {
            throw new Error('Actual start date must be before or equal to actual end date');
          }
          updates.actualDuration = calculateDuration(normalizedDate, task.actualEndDate);
        }
        // Do not modify progress when setting actual start date
      } else if (field === 'actualEndDate') {
        if (task.actualStartDate) {
          if (normalizedDate < task.actualStartDate) {
            throw new Error('Actual end date must be after or equal to actual start date');
          }
          updates.actualDuration = calculateDuration(task.actualStartDate, normalizedDate);
        }
        updates.progress = 100; // Set progress to 100% when actual end date is set
      }

      updateTask(task.id, updates);
    } catch (error) {
      toast({
        title: "Date Validation Error",
        description: error instanceof Error ? error.message : 'Invalid date',
        variant: "destructive"
      });
    }
  };

  const handleViewChange = (taskId: string, value: 'Internal' | 'External') => {
    updateTask(taskId, { view: value });
  };

  const renderDateCell = (taskId: string, field: keyof Task, value: Date | null | undefined, isParent: boolean | undefined) => {
    const dateValue = value ? new Date(value) : null;
    
    // For parent tasks, just show the date value but don't allow editing
    if (isParent) {
      return (
        <div className="px-2 py-1 text-xs">
          {dateValue ? format(dateValue, 'dd/MM/yyyy') : '-'}
        </div>
      );
    }

    // Get today's date for disabling future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            className={cn(
              "w-full h-5 justify-start text-left font-normal text-xs px-2 py-0",
              !dateValue && "text-muted-foreground"
            )}
          >
            {dateValue ? format(dateValue, 'dd/MM/yyyy') : <span>Pick date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue || undefined}
            onSelect={(date) => handleDateSelect(taskId, field, date ?? null)}
            disabled={field.includes('actual') ? { after: today } : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  };

  const toggleFrozenColumns = () => {
    setFrozenColumns(!frozenColumns);
  };

  const renderEditableCell = (taskId: string, field: keyof Task, value: any, type: string = 'text', isParent?: boolean) => {
    // For parent tasks, don't allow editing dates or progress
    if (isParent && (field.includes('Date') || field === 'progress')) {
      if (field.includes('Date')) {
        return (
          <div className="px-2 py-1 text-xs">
            {value ? format(new Date(value), 'dd/MM/yyyy') : '-'}
          </div>
        );
      }
      
      if (field === 'progress') {
        return (
          <div className="px-2 py-1 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-full h-1.5 bg-gray-200 rounded">
                <div 
                  className={cn(
                    "h-1.5 rounded-full",
                    (value || 0) === 100 ? "bg-green-500" : "bg-blue-500"
                  )}
                  style={{ width: `${value || 0}%` }}
                />
              </div>
              <span>{value || 0}%</span>
            </div>
          </div>
        );
      }
    }

    if (field.includes('Date')) {
      return renderDateCell(taskId, field as keyof Task, value, isParent);
    }

    if (field === 'view') {
      // For parent tasks, just show a dash for view field
      if (isParent) {
        return (
          <div className="px-2 py-1 text-xs">
            -
          </div>
        );
      }
      
      return (
        <Select
          value={value || 'External'}
          onValueChange={(value) => handleViewChange(taskId, value as 'Internal' | 'External')}
        >
          <SelectTrigger className="h-6 text-xs px-1 py-0 w-full min-h-0 border-0">
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="External">External</SelectItem>
            <SelectItem value="Internal">Internal</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (editingField && editingField.taskId === taskId && editingField.field === field) {
      return (
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleBlur();
            } else if (e.key === 'Escape') {
              setEditingField(null);
            }
          }}
          className="w-full px-2 py-1 text-xs border rounded"
          placeholder={field === 'taskName' ? `<task${tasks.find(t => t.id === taskId)?.siNo}>` : ''}
          autoFocus
        />
      );
    }

    // For task name field, add a tooltip for long names
    if (field === 'taskName') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span 
                onDoubleClick={() => handleDoubleClick(taskId, field, value)}
                className={cn(
                  "text-xs cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block w-full truncate",
                  tasks.find(t => t.id === taskId)?.level === 0 && "font-bold"
                )}
              >
                {value ?? '-'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{value ?? '-'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <span 
        onDoubleClick={() => handleDoubleClick(taskId, field, value)}
        className={cn(
          "text-xs cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block w-full",
          field === 'progress' && "relative"
        )}
      >
        {field === 'progress' ? (
          <div className="flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-1.5 mr-2">
              <div 
                className={cn(
                  "h-1.5 rounded-full",
                  (value || 0) === 100 ? "bg-green-500" : "bg-blue-500"
                )}
                style={{ width: `${Math.min(value || 0, 100)}%` }}
              ></div>
            </div>
            <span>{value || 0}%</span>
          </div>
        ) : (
          <div className="truncate">{value ?? '-'}</div>
        )}
      </span>
    );
  };

  const renderProductDropdown = (taskId: string, isParent: boolean | undefined, productId: string | undefined) => {
    // If task is a parent, just show a dash
    if (isParent) {
      return <span className="text-gray-500">-</span>;
    }

    // For leaf nodes, show product dropdown
    return (
      <Select
        value={productId || ''}
        onValueChange={(value) => handleAssignProduct(taskId, value)}
      >
        <SelectTrigger className="h-6 text-xs px-1 py-0 w-full min-h-0 border-0">
          <SelectValue placeholder="Product" />
        </SelectTrigger>
        <SelectContent>
          {PRODUCTS.map(product => (
            <SelectItem key={product.id} value={product.id}>
              {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const getStageColorForTask = (task: Task) => {
    if (!task.stageId) return null;
    const stage = STAGES.find(s => s.id === task.stageId);
    return stage ? stage.colorCode : null;
  };

  const getStageNameForTask = (task: Task) => {
    if (!task.stageId) return null;
    const stage = STAGES.find(s => s.id === task.stageId);
    return stage ? stage.name : null;
  };

  // Check if a task has children
  const hasChildren = (task: Task) => {
    return tasks.some(t => 
      !t.isDeleted && 
      t.level > task.level && 
      tasks.indexOf(t) > tasks.indexOf(task) && 
      !tasks.some(intermediate => 
        intermediate.level <= task.level && 
        tasks.indexOf(intermediate) > tasks.indexOf(task) && 
        tasks.indexOf(intermediate) < tasks.indexOf(t)
      )
    );
  };

  // Check if a task has a selected parent
  const hasSelectedParent = (task: Task) => {
    const taskIndex = tasks.findIndex(t => t.id === task.id);
    if (taskIndex <= 0) return false;
    
    // Look at all tasks before this one to find potential parents
    for (let i = taskIndex - 1; i >= 0; i--) {
      const potentialParent = tasks[i];
      // If we find a task with lower level, it's the closest potential parent
      if (potentialParent.level < task.level) {
        // Check if this parent is selected
        return selectedIds.has(potentialParent.id);
      }
    }
    return false;
  };

  // Handle checkbox click
  const handleCheckboxClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation(); // Prevent row click from triggering
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // If this task has a selected parent, prevent deselection
    if (hasSelectedParent(task) && selectedIds.has(task.id)) {
      e.preventDefault();
      toast({
        title: "Cannot Deselect Child Task",
        description: "You must deselect the parent task first",
        variant: "default"
      });
      return;
    }
    // Use the toggleSelection from useTaskStore
    toggleSelection(task.id);
  };

   // Handle row click to select a task

   const handleRowClick = (taskId: string) => {
    if (isSelecting) {
      // Use the toggleSelection from useTaskStore
      toggleSelection(taskId);
    } else {
      setActiveTask(taskId);
    }
  };

  const handleRemarksSave = (taskId: string, remarks: Remark[]) => {
    updateTask(taskId, { remarks });
    toast({
      title: "Remarks Saved",
      description: "Task remarks have been updated successfully",
      variant: "default"
    });
  };

  const handleRemarksDoubleClick = (task: Task) => {
    setSelectedTaskForRemarks(task);
    setShowRemarksModal(true);
  };

  const handleDownloadExcel = (viewType: 'all' | 'external') => {
    // Filter tasks based on viewType
    const tasksToExport = viewType === 'all' 
      ? visibleTasks 
      : visibleTasks.filter(task => task.view === 'External');

    // Prepare data for Excel
    const excelData = tasksToExport.map(task => ({
      'SI': task.siNo,
      'WBS': task.wbsNo,
      'Task': task.taskName,
      'Product': task.productId || '',
      'Predecessors': task.predecessorIds || '',
      'Duration': task.duration || '',
      'Start Date': task.startDate ? format(task.startDate, 'dd/MM/yyyy') : '',
      'End Date': task.endDate ? format(task.endDate, 'dd/MM/yyyy') : '',
      'Actual Start': task.actualStartDate ? format(task.actualStartDate, 'dd/MM/yyyy') : '',
      'Actual End': task.actualEndDate ? format(task.actualEndDate, 'dd/MM/yyyy') : '',
      'Actual Duration': task.actualDuration || '',
      'Progress %': task.progress || 0,
      'Schedule %': calculateSchedulePercentage(task.startDate, task.endDate),
      'View': task.view || 'External',
      'Status': getTaskStatus(task)
    }));

    // Create worksheet
    const ws = xlsxUtils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 5 },  // SI
      { wch: 8 },  // WBS
      { wch: 40 }, // Task
      { wch: 12 }, // Product
      { wch: 12 }, // Predecessors
      { wch: 10 }, // Duration
      { wch: 12 }, // Start Date
      { wch: 12 }, // End Date
      { wch: 12 }, // Actual Start
      { wch: 12 }, // Actual End
      { wch: 12 }, // Actual Duration
      { wch: 12 }, // Progress %
      { wch: 12 }, // Schedule %
      { wch: 10 }, // View
      { wch: 12 }  // Status
    ];
    ws['!cols'] = columnWidths;

    // Create workbook
    const wb = { Sheets: { 'Tasks': ws }, SheetNames: ['Tasks'] };

    // Generate Excel file with appropriate name
    const fileName = viewType === 'all' ? 'Tasks-All.xlsx' : 'Tasks-External.xlsx';
    xlsxWriteFile(wb, fileName);
  };

  const handleDiscardPlan = () => {
    // Clear all tasks
    setTasks([]);
    // Clear any selections
    clearSelection();
    setActiveTask(null);
    
    toast({
      title: "Plan Discarded",
      description: "The entire plan has been deleted",
      variant: "default"
    });
  };

  const handleSaveAsTemplate = (name: string) => {
    // Create and save template
    const newTemplate = createTemplate(name, tasks);
    const updatedTemplates = saveTemplate(newTemplate);
    
    // Update templates state
    setTemplates(updatedTemplates);
    
    toast({
      title: "Template Saved",
      description: `The template "${name}" has been saved successfully`,
      variant: "default"
    });
  };
  
  const handleLoadTemplate = (templateId: string) => {
    // Find the template
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      toast({
        title: "Template Not Found",
        description: "The selected template could not be found",
        variant: "destructive"
      });
      return;
    }
    
    // Convert template tasks to regular tasks
    const newTasks = convertTemplateTasks(template.tasks);
    
    // Set tasks in the store
    setTasks(newTasks);
    
    toast({
      title: "Template Loaded",
      description: `The template "${template.name}" has been loaded successfully`,
      variant: "default"
    });
  };

  const toggleTaskCollapse = (taskId: string) => {
    const newCollapsedTasks = new Set(collapsedTasks);
    if (newCollapsedTasks.has(taskId)) {
      newCollapsedTasks.delete(taskId);
    } else {
      newCollapsedTasks.add(taskId);
    }
    setCollapsedTasks(newCollapsedTasks);
  };

  const isTaskHidden = (task: Task): boolean => {
    if (task.level === 0) return false;
    
    // Look backwards through tasks to find parent
    const taskIndex = visibleTasks.findIndex(t => t.id === task.id);
    for (let i = taskIndex - 1; i >= 0; i--) {
      const potentialParent = visibleTasks[i];
      if (potentialParent.level < task.level) {
        // If any parent is collapsed, this task should be hidden
        if (collapsedTasks.has(potentialParent.id)) {
          return true;
        }
        // If we've reached level 0, we can stop looking
        if (potentialParent.level === 0) break;
      }
    }
    return false;
  };

  // Add this helper function after other utility functions
  const getScheduleStatus = (schedulePercentage: number, actualProgress: number): {
    color: string;
    status: string;
  } => {
    if (schedulePercentage === 100 && actualProgress < 100) {
      return {
        color: "bg-red-500",
        status: "Critically Delayed"
      };
    }
    if (schedulePercentage < 100 && schedulePercentage > actualProgress) {
      return {
        color: "bg-yellow-500",
        status: "Delayed"
      };
    }
    if (schedulePercentage < actualProgress) {
      return {
        color: "bg-green-500",
        status: "Before Time"
      };
    }
    return {
      color: "bg-blue-500",
      status: "On Time"
    };
  };

  // Render a single task row
  const renderTaskRow = (task: Task) => {
    const status = getTaskStatus(task);
    const statusColors = {
      'Not Started': 'text-gray-500',
      'In Progress': 'text-blue-500',
      'Completed': 'text-green-500',
      'Delayed': 'text-red-500'
    };

    const pendingResponsesCount = task.remarks?.filter(r => !r.response).length || 0;

    return (
      <tr 
        key={task.id}
        id={`task-row-${task.id}`}
        className={cn("hover:bg-gray-100",
          activeTaskId === task.id ? 'bg-blue-100' : '',
          isSelecting && selectedIds.has(task.id) ? 'bg-blue-100' : '')}
        onClick={() => handleRowClick(task.id)}
        style={{ cursor: 'pointer' }}
      >
        {isSelecting && (
          <td className={cn(
            "px-1 py-1 border border-gray-200 w-[30px]", 
            frozenColumns && "sticky left-0 z-30",
            activeTaskId === task.id ? 'bg-blue-100' : (isSelecting && selectedIds.has(task.id) ? 'bg-blue-100' : 'bg-white')
          )}>
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={selectedIds.has(task.id)}
                onChange={() => {}}
                onClick={(e) => handleCheckboxClick(e, task.id)}
                className={cn(
                  "rounded border-gray-300 h-3 w-3",
                  hasSelectedParent(task) && selectedIds.has(task.id) && "opacity-60 cursor-not-allowed"
                )}
                disabled={hasSelectedParent(task) && selectedIds.has(task.id)}
              />
              {hasChildren(task) && (
                <span className="ml-1 text-xs text-blue-500" title="Has child tasks">
                  •
                </span>
              )}
            </div>
          </td>
        )}
        <td className={cn(
          "text-xs text-gray-500 border border-gray-200 w-[30px]", 
          frozenColumns && `sticky ${isSelecting ? 'left-[30px]' : 'left-0'} z-30`,
          activeTaskId === task.id ? 'bg-blue-100' : (isSelecting && selectedIds.has(task.id) ? 'bg-blue-100' : 'bg-white')
        )}>
          {task.siNo}
        </td>
        <td className={cn(
          "text-xs text-gray-500 border border-gray-200 w-[40px] truncate", 
          frozenColumns && `sticky ${isSelecting ? 'left-[60px]' : 'left-[30px]'} z-30`,
          activeTaskId === task.id ? 'bg-blue-100' : (isSelecting && selectedIds.has(task.id) ? 'bg-blue-100' : 'bg-white')
        )}>
          {task.wbsNo}
        </td>
        <td 
          className={cn(
            "px-1 border border-gray-200 relative", 
            frozenColumns && `sticky ${isSelecting ? 'left-[100px]' : 'left-[70px]'} z-30`,
            activeTaskId === task.id ? 'bg-blue-100' : (isSelecting && selectedIds.has(task.id) ? 'bg-blue-100' : 'bg-white')
          )}
          style={{ 
            paddingLeft: `${task.level * 20 + 8}px`,
            width: '300px' // Fixed width matched to header
          }}
        >
          {/* Stage color indicator */}
          {task.stageId && (
            <div 
              className="absolute left-0 top-0 bottom-0 w-1" 
              style={{ backgroundColor: getStageColorForTask(task) || 'transparent' }}
              title={getStageNameForTask(task) || ''}
            />
          )}
          <div className="flex items-center">
            {task.isParent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTaskCollapse(task.id);
                }}
              >
                {collapsedTasks.has(task.id) ? (
                  <ChevronRight className="h-3 w-3 text-gray-500" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                )}
              </Button>
            )}
            {task.goLive && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 mr-1" />}
            {task.financialMilestone && <Star className="w-3 h-3 text-blue-500 fill-blue-500 mr-1" />}
            <div className="w-full overflow-hidden">
              {renderEditableCell(task.id, 'taskName', task.taskName)}
            </div>
          </div>
        </td>
        <td className="border border-gray-200 w-[70px]">
          {renderProductDropdown(task.id, task.isParent, task.productId)}
        </td>
        <td className=" border border-gray-200 w-[100px]">
          {renderEditableCell(task.id, 'predecessorIds', task.predecessorIds)}
        </td>
        <td className=" border border-gray-200 w-[50px]">
          {renderEditableCell(task.id, 'duration', task.duration, 'number', task.isParent)}
        </td>
        <td className=" border border-gray-200 w-[100px]">
          {renderDateCell(task.id, 'startDate', task.startDate, task.isParent)}
        </td>
        <td className=" border border-gray-200 w-[100px]">
          {renderDateCell(task.id, 'endDate', task.endDate, task.isParent)}
        </td>
        <td className="  border border-gray-200 w-[100px]">
          {renderDateCell(task.id, 'actualStartDate', task.actualStartDate, task.isParent)}
        </td>
        <td className=" border border-gray-200 w-[100px]">
          {renderDateCell(task.id, 'actualEndDate', task.actualEndDate, task.isParent)}
        </td>
        <td className=" border border-gray-200 w-[50px] text-xs pl-2">
          {task.actualStartDate && task.actualEndDate && task.actualDuration !== null
            ? task.actualDuration 
            : '-'}
        </td>
        <td className=" border border-gray-200 w-[100px]">
          {renderEditableCell(task.id, 'progress', task.progress || 0, 'number', task.isParent)}
        </td>
        <td className="border border-gray-200 w-[100px]">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="px-2 py-1 text-xs">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mr-2">
                      {(() => {
                        const schedulePercentage = calculateSchedulePercentage(task.startDate, task.endDate);
                        const actualProgress = task.progress || 0;
                        const { color, status } = getScheduleStatus(schedulePercentage, actualProgress);
                        return (
                          <div 
                            className={cn(
                              "h-1.5 rounded-full",
                              color
                            )}
                            style={{ width: `${schedulePercentage}%` }}
                          ></div>
                        );
                      })()}
                    </div>
                    <span>{calculateSchedulePercentage(task.startDate, task.endDate)}%</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {(() => {
                  const schedulePercentage = calculateSchedulePercentage(task.startDate, task.endDate);
                  const actualProgress = task.progress || 0;
                  const { status } = getScheduleStatus(schedulePercentage, actualProgress);
                  return (
                    <div className="text-xs">
                      <div>{status}</div>
                    </div>
                  );
                })()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>
        <td className=" border border-gray-200 w-[80px]">
          {renderEditableCell(task.id, 'view', task.view || 'External', 'text', task.isParent)}
        </td>
        <td className=" border border-gray-200 w-[100px]">
          <ResourceCell taskId={task.id} taskName={task.taskName || `<task${task.siNo}>`} />
        </td>
        <td className=" border border-gray-200 w-[90px]">
          <span className={`text-xs ${statusColors[status]}`}>
            {status}
          </span>
        </td>
        <td 
          className="border border-gray-200 w-[100px] text-xs px-2 py-1 cursor-pointer hover:bg-gray-100"
          onDoubleClick={() => handleRemarksDoubleClick(task)}
        >
          {task.remarks?.length > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-blue-500" />
                <span>{task.remarks.length} remark(s)</span>
              </div>
              {pendingResponsesCount > 0 && (
                <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-xs font-medium">
                  {pendingResponsesCount}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-500">
              <MessageSquarePlus className="w-4 h-4" />
              <span>Add remark</span>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-2 border-b flex items-center gap-3 bg-white">
        <div className="flex items-center">
          <Button
            onClick={handleAddTask}
            className="bg-blue-500 hover:bg-blue-600 h-8 text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Task
          </Button>
          <Button
            onClick={() => {
              setSelecting(!isSelecting);
              if (!isSelecting) {
                setActiveTask(null);
              } else {
                clearSelection();
              }
            }}
            variant={isSelecting ? "secondary" : "ghost"}
            className="h-8 px-3 text-sm"
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1" />
            {isSelecting ? 'Done' : 'Select'}
          </Button>
        </div>

        <div className="flex items-center">
          <Button
            onClick={handlePromote}
            variant="ghost"
            className={`h-8 px-1 text-sm ${
              !isSelecting || selectedIds.size === 0 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            disabled={!isSelecting || selectedIds.size === 0}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Promote
          </Button>
          <Button
            onClick={handleDemote}
            variant="ghost"
            className={`h-8 px-3 text-sm ${
              !isSelecting || selectedIds.size === 0 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            disabled={!isSelecting || selectedIds.size === 0}
          >
            <ChevronRight className="w-3.5 h-3.5" />
            Demote
          </Button>
          <Button
            onClick={handleMoveUp}
            variant="ghost"
            className={`h-8 px-1 text-sm ${
              !activeTaskId 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            disabled={!activeTaskId}
          >
            <CircleArrowUp className="w-5 h-5 text-blue-600"/>
          </Button>
          <div className="h-5 pl-1 pr-1" />
          <Button
            onClick={handleMoveDown}
            variant="ghost"
            className={`h-8 px-1 text-sm ${
              !activeTaskId 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            disabled={!activeTaskId}
          >
            <CircleArrowDown className="w-5 h-5 text-blue-600" />
          </Button>
          <Button
            onClick={toggleFrozenColumns}
            variant={frozenColumns ? "secondary" : "ghost"}
            className="h-8 px-2 text-sm"
            title={frozenColumns ? "Unfreeze columns" : "Freeze columns"}
          >
            <Snowflake className={cn("w-4 h-4", frozenColumns && "text-blue-500")} />
          </Button>
          <div className="h-5 pl-1 pr-1" />
          <Button
            onClick={handleDelete}
            variant="destructive"
            className={`h-8 px-1 text-sm ${
              !isSelecting || selectedIds.size === 0 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            disabled={!isSelecting || selectedIds.size === 0}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center">
          
          <Button
            onClick={undo}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            onClick={redo}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleMarkGoLive}
            variant="secondary"
            className="h-8 px-0.5 text-sm text-white bg-yellow-400 hover:bg-yellow-500"
            disabled={!activeTaskId}
          >
            <Star className="w-3.5 h-3.5" />
            Go-Live
          </Button>
          <Button
            onClick={handleMarkFinancialMilestone}
            variant="secondary"
            className="h-8 px-0.5 text-sm text-white bg-blue-400 hover:bg-blue-500"
            disabled={!activeTaskId}
          >
            <Star className="w-3.5 h-3.5" />
            Financial
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                className="h-8 px-2 text-sm"
                disabled={!activeTaskId}
              >
                <Layers className="w-3.5 h-3.5" />
                + Stage
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {STAGES.map(stage => (
                <DropdownMenuItem 
                  key={stage.id}
                  onClick={() => handleAssignStage(stage.id)}
                >
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: stage.colorCode }}
                    />
                    {stage.name}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            className="bg-gray-800 hover:bg-black h-8 px-3 text-sm"
            onClick={() => setShowTemplateModal(true)}
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Template
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="bg-gray-800 hover:bg-black h-8 px-3 text-sm"
                disabled={templates.length === 0}
              >
                <Import className="w-3.5 h-3.5 mr-1" /> 
                Plan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {templates.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-gray-500">No templates saved</div>
              ) : (
                templates.map(template => (
                  <DropdownMenuItem 
                    key={template.id}
                    onClick={() => handleLoadTemplate(template.id)}
                    className="cursor-pointer"
                  >
                    <span>{template.name}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {template.createdAt.toLocaleDateString()}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Link href="http://localhost:3001/RAID/03d3fadf-0c5f-4f71-83ef-456aa58255f2/raid">
            <Button
              className="bg-blue-400 hover:bg-blue-500 h-8 px-3 text-sm"
              title="Raid Log"
            >
              <FlagTriangleRight className="w-3.5 h-3.5 fill-red-500" />
              Raid Log
            </Button>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="bg-green-500 hover:bg-green-600 h-8 px-3 text-sm"
                title="Download as Excel"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-43">
              <DropdownMenuItem onClick={() => handleDownloadExcel('all')} className="cursor-pointer">
                <View className="w-4 h-4" />
                <span>Internal + External</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadExcel('external')} className="cursor-pointer">
                <View className="w-4 h-4 mr-1" />
                <span>External</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="h-8 px-3 text-sm"
                title="Discard Plan"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Discard
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the entire plan. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-8 text-sm">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="h-8 text-sm bg-red-500 hover:bg-red-600"
                  onClick={handleDiscardPlan}
                >
                  Delete Plan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Single scrollable container for both header and body */}
      <div className="flex-1 overflow-auto pl-2 pr-2">
        <table className="w-full border-collapse table-fixed min-w-[1200px]">
          <thead className="sticky top-0 bg-white z-20">
            <tr className="bg-gray-50">
                {isSelecting && (
                <th className={cn(
                  "border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[30px]", 
                  frozenColumns && "sticky left-0 z-40 bg-gray-50"
                )} title="Select Tasks">
                  <div className="flex justify-center">Sel</div>
                    </th>
                    )}
              <th className={cn(
                "border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[30px]", 
                frozenColumns && `sticky ${isSelecting ? 'left-[30px]' : 'left-0'} z-40 bg-gray-50`
              )} title="Serial Number">
                    SI
                    </th>
              <th className={cn(
                "border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[40px]", 
                frozenColumns && `sticky ${isSelecting ? 'left-[60px]' : 'left-[30px]'} z-40 bg-gray-50`
              )} title="Work Breakdown Structure">
                    WBS
                    </th>
              <th 
                className={cn(
                  "border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[300px]", 
                  frozenColumns && `sticky ${isSelecting ? 'left-[100px]' : 'left-[70px]'} z-40 bg-gray-50`
                )} 
                title="Task Name"
              >
                    Task
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[70px]" title="Product">
                    Product
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[60px]" title="Predecessors">
                    Pred.
                    </th>
                    <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[50px]" title="Duration">
                    Dur.
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[85px]" title="Start Date">
                    Start
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[85px]" title="End Date">
                    End
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[85px]" title="Actual Start Date">
                    Act. Start
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[85px]" title="Actual End Date">
                    Act. End
                    </th>
                    <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[50px]" title="Actual Duration">
                    Act. Dur.
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[70px]" title="Progress Percentage">
                    Progress%
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[70px]" title="Schedule Percentage">
                Schedule%
              </th>
                    <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[80px]" title="View Type">
                    View
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[80px]" title="Resource Assignment">
                    Resource
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[70px]" title="Task Status">
                    Status
                    </th>
              <th className="border border-gray-200 py-1 font-medium text-gray-700 text-xs w-[90px]" title="Remarks">
                    Remarks
                    </th>
            </tr>
            </thead>
          <tbody>
            {visibleTasks.filter(task => !isTaskHidden(task)).map(task => renderTaskRow(task))}
          </tbody>
        </table>
      </div>

      {showDeleteDialog && (
        <DeleteDialog 
          tasks={visibleTasks.filter(t => selectedIds.has(t.id))} 
          onClose={() => {
            setShowDeleteDialog(false);
            clearSelection();
          }} 
        />
      )}

      {/* Add RemarksModal */}
      {showRemarksModal && selectedTaskForRemarks && (
        <RemarksModal
          isOpen={showRemarksModal}
          onClose={() => {
            setShowRemarksModal(false);
            setSelectedTaskForRemarks(null);
          }}
          taskId={selectedTaskForRemarks.id}
          taskName={selectedTaskForRemarks.taskName}
          initialRemarks={selectedTaskForRemarks.remarks}
          onSave={(remarks) => handleRemarksSave(selectedTaskForRemarks.id, remarks)}
        />
      )}

      {/* Add SaveTemplateModal */}
      <SaveTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSave={handleSaveAsTemplate}
      />
    </div>
  );
}
