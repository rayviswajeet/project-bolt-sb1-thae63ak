'use client';

import { useState, useRef, useEffect } from 'react';
import { Task } from '@/types/task';
import { useTaskStore } from '@/store/taskStore';
import { Diamond, ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format, addDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { validatePredecessors, validateTaskDates, getMaxPredecessorEndDate } from '@/lib/taskUtils';
import ResourceCell from '@/components/ResourceCell';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskRowProps {
  task: Task;
}

export default function TaskRow({ task }: TaskRowProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateTask, isSelecting, selectedIds, toggleSelection, tasks, activeTaskId } = useTaskStore();
  const { toast } = useToast();

  // Check if this task has a selected parent
  const hasSelectedParent = (() => {
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
  })();

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      if (editingField === 'taskName') {
        setEditValue(task.taskName || `<task${task.siNo}>`);
        inputRef.current.select();
      } else if (editingField === 'progress') {
        setEditValue(String(task.progress || 0));
        inputRef.current.select();
      } else {
        setEditValue(String(task[editingField as keyof Task] || ''));
        inputRef.current.select();
      }
    }
  }, [editingField, task]);

  const calculateEndDate = (startDate: Date, duration: number): Date => {
    return addDays(startDate, duration);
  };

  const calculateDuration = (startDate: Date, endDate: Date): number => {
    return differenceInDays(endDate, startDate);
  };

  const detectCircularDependency = (predecessorIds: string): boolean => {
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
    
    return 'YTS';
  };

  const handleDoubleClick = (field: string, value: any) => {
    if (field.includes('Date')) return;
    if (field === 'view') return; // View is handled separately with dropdown
    setEditingField(field);
    setEditValue(String(value || ''));
  };

  const validateUpdate = (field: string, value: any) => {
    if (field === 'predecessorIds' && value) {
      // Parse and validate predecessor IDs
      const siNos = value.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
      
      // Validate SI numbers exist
      const invalidSiNos = siNos.filter(siNo => !tasks.find(t => t.siNo === siNo));
      if (invalidSiNos.length > 0) {
        throw new Error(`Invalid predecessor SI numbers: ${invalidSiNos.join(', ')}`);
      }
      
      // Check for self-reference
      if (siNos.includes(task.siNo)) {
        throw new Error('Task cannot depend on itself');
      }
      
      // Check for circular dependency
      if (detectCircularDependency(value)) {
        throw new Error('Circular dependency detected');
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

    try {
      let value = editValue.trim();
      if (editingField === 'taskName' && !value) {
        value = `<task${task.siNo}>`;
      }

      validateUpdate(editingField, value);

      if (value !== String(task[editingField as keyof Task] || '')) {
        const updates: any = { [editingField]: value };
        
        // If updating predecessors, check if we need to adjust dates
        if (editingField === 'predecessorIds') {
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
        if (editingField === 'duration' && task.startDate) {
          const duration = parseInt(value);
          if (!isNaN(duration)) {
            updates.endDate = calculateEndDate(task.startDate, duration);
          }
        }

        // If updating progress, handle special cases
        if (editingField === 'progress') {
          const progress = parseFloat(value);
          if (!isNaN(progress)) {
            updates[editingField] = Math.min(Math.max(progress, 0), 100);
            // If progress is 100%, set actual end date if not already set
            if (progress === 100 && !task.actualEndDate && task.actualStartDate) {
              updates.actualEndDate = new Date();
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
      if (editingField === 'taskName') {
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
      setEditValue(task.taskName || '');
    }
  };

  const handleDateSelect = (field: string, date: Date | null) => {
    if (!date) return;

    try {
      const updates: any = { [field]: date };

      // Auto-calculate duration and dates
      if (field === 'startDate') {
        if (task.endDate) {
          updates.duration = calculateDuration(date, task.endDate);
        } else if (task.duration) {
          updates.endDate = calculateEndDate(date, task.duration);
        }
        
        // Check if this violates predecessor constraints
        if (task.predecessorIds) {
          const maxPredEndDate = getMaxPredecessorEndDate(tasks, task.predecessorIds);
          if (maxPredEndDate && date <= maxPredEndDate) {
            throw new Error('Start date must be after all predecessor end dates');
          }
        }
      } else if (field === 'endDate') {
        if (task.startDate) {
          updates.duration = calculateDuration(task.startDate, date);
        }
      } else if (field === 'actualStartDate') {
        if (task.actualEndDate) {
          updates.actualDuration = calculateDuration(date, task.actualEndDate);
        }
        // Set progress to 50% when actual start date is set
        if (!task.progress || task.progress === 0) {
          updates.progress = 50;
        }
      } else if (field === 'actualEndDate') {
        if (task.actualStartDate) {
          updates.actualDuration = calculateDuration(task.actualStartDate, date);
        }
        // Set progress to 100% when actual end date is set
        updates.progress = 100;
      }

      const errors = validateTaskDates(updates, tasks);
      if (errors.length > 0) {
        throw new Error(errors.join(', '));
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

  const handleViewChange = (value: 'Internal' | 'External') => {
    updateTask(task.id, { view: value });
  };

  const renderDateCell = (field: keyof Task, value: Date | null | undefined) => {
    const dateValue = value ? new Date(value) : null;
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            className={cn(
              "w-full h-7 justify-start text-left font-normal text-xs px-2 py-1",
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
            onSelect={(date) => handleDateSelect(field, date)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  };

  const renderEditableCell = (field: keyof Task, value: any, type: string = 'text') => {
    if (field.includes('Date')) {
      return renderDateCell(field as keyof Task, value);
    }

    if (field === 'view') {
      return (
        <Select
          value={task.view || 'External'}
          onValueChange={(value) => handleViewChange(value as 'Internal' | 'External')}
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

    if (editingField === field) {
      return (
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-xs border rounded"
          placeholder={field === 'taskName' ? `<task${task.siNo}>` : ''}
        />
      );
    }

    return (
      <span 
        onDoubleClick={() => handleDoubleClick(field, value)}
        className={cn(
          "text-xs cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block w-full overflow-hidden text-ellipsis whitespace-nowrap",
          field === 'taskName' && task.level === 0 && "font-bold", // Make level 0 task names bold
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
                style={{ width: `${value || 0}%` }}
              ></div>
            </div>
            <span>{value || 0}%</span>
          </div>
        ) : (
          value ?? '-'
        )}
      </span>
    );
  };

  // Check if this task has children
  const hasChildren = tasks.some(t => 
    !t.isDeleted && 
    t.level > task.level && 
    tasks.indexOf(t) > tasks.indexOf(task) && 
    !tasks.some(intermediate => 
      intermediate.level <= task.level && 
      tasks.indexOf(intermediate) > tasks.indexOf(task) && 
      tasks.indexOf(intermediate) < tasks.indexOf(t)
    )
  );

  const status = getTaskStatus(task);
  const statusColors = {
    'Not Started': 'text-gray-500',
    'In Progress': 'text-blue-500',
    'Completed': 'text-green-500',
    'Delayed': 'text-red-500'
  };

  // Handle checkbox click
  const handleCheckboxClick = (e: React.MouseEvent) => {
    // If this task has a selected parent, prevent deselection
    if (hasSelectedParent && selectedIds.has(task.id)) {
      e.preventDefault();
      toast({
        title: "Cannot Deselect Child Task",
        description: "You must deselect the parent task first",
        variant: "default"
      });
      return;
    }
    
    toggleSelection(task.id);
  };

  return (
    <div className={`${activeTaskId === task.id ? 'bg-blue-50' : ''}`}>
      <table className="w-full border-collapse table-fixed">
        <tbody>
          <tr className="hover:bg-gray-50 h-10">
            {isSelecting && (
              <td className="px-2 py-1 border border-gray-200 w-[60px]">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => {}}
                    onClick={handleCheckboxClick}
                    className={cn(
                      "rounded border-gray-300",
                      hasSelectedParent && selectedIds.has(task.id) && "opacity-60 cursor-not-allowed"
                    )}
                    disabled={hasSelectedParent && selectedIds.has(task.id)}
                  />
                  {hasChildren && (
                    <span className="ml-2 text-xs text-blue-500" title="Has child tasks">
                      •
                    </span>
                  )}
                </div>
              </td>
            )}
            <td className="px-2 py-1 text-xs text-gray-500 border border-gray-200 w-[60px]">{task.siNo}</td>
            <td className="px-2 py-1 text-xs text-gray-500 border border-gray-200 w-[80px] overflow-hidden text-ellipsis whitespace-nowrap">{task.wbsNo}</td>
            <td 
              className="px-2 py-1 border border-gray-200 w-[250px]"
              style={{ paddingLeft: `${task.level * 20 + 8}px` }}
            >
              <div className="flex items-center gap-1 overflow-hidden">
                {task.isMilestone && <Diamond className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                <div className="overflow-hidden">
                  {renderEditableCell('taskName', task.taskName)}
                </div>
              </div>
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[100px]">
              {renderEditableCell('predecessorIds', task.predecessorIds)}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[80px]">
              {renderEditableCell('duration', task.duration, 'number')}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[100px]">
              {renderDateCell('startDate', task.startDate)}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[100px]">
              {renderDateCell('endDate', task.endDate)}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[100px]">
              {renderDateCell('actualStartDate', task.actualStartDate)}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[100px]">
              {renderDateCell('actualEndDate', task.actualEndDate)}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[80px]">
              {task.actualDuration !== null && task.actualDuration !== undefined 
                ? task.actualDuration 
                : (task.actualStartDate && task.actualEndDate 
                    ? calculateDuration(task.actualStartDate, task.actualEndDate) 
                    : '-')}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[100px]">
              {renderEditableCell('progress', task.progress || 0, 'number')}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[80px]">
              {renderEditableCell('view', task.view || 'External')}
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[120px]">
              <ResourceCell taskId={task.id} taskName={task.taskName || `<task${task.siNo}>`} />
            </td>
            <td className="px-2 py-1 border border-gray-200 w-[80px]">
              <span className={`text-xs ${statusColors[status]}`}>
                {status}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
