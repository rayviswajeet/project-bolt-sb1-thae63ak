'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => void;
  task?: Task;
  isEdit?: boolean;
}

const STAGE_OPTIONS = [
  'Initiated',
  'Requirements',
  'Design',
  'HW infra',
  'SIT Testing',
  'UAT',
  'Parallel',
  'QA setup',
  'Prod Setup'
];

export default function TaskModal({ isOpen, onClose, onSave, task, isEdit = false }: TaskModalProps) {
  const [taskName, setTaskName] = useState('');
  const [predecessors, setPredecessors] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [stage, setStage] = useState('Design');
  const [product, setProduct] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);
  const [isFinancialMilestone, setIsFinancialMilestone] = useState(false);

  useEffect(() => {
    if (task) {
      setTaskName(task.taskName || '');
      setPredecessors(task.predecessorIds || '');
      setStartDate(task.startDate || new Date());
      setDuration(task.duration || undefined);
      setEndDate(task.endDate || undefined);
      setStage(task.stage || 'Design');
      setProduct(task.product || '');
      setIsMilestone(task.isMilestone || false);
      setIsFinancialMilestone(task.isFinancialMilestone || false);
    } else {
      // Reset form for new task
      setTaskName('');
      setPredecessors('');
      setStartDate(new Date());
      setDuration(undefined);
      setEndDate(undefined);
      setStage('Design');
      setProduct('');
      setIsMilestone(false);
      setIsFinancialMilestone(false);
    }
  }, [task, isOpen]);

  // Calculate end date when start date and duration change
  useEffect(() => {
    if (startDate && duration !== undefined && duration >= 0) {
      setEndDate(addDays(startDate, duration));
    }
  }, [startDate, duration]);

  const handleSave = () => {
    const taskData: Partial<Task> = {
      taskName: taskName.trim() || undefined,
      predecessorIds: predecessors.trim() || undefined,
      startDate,
      duration,
      endDate,
      stage,
      product: product.trim() || undefined,
      isMilestone,
      isFinancialMilestone
    };

    onSave(taskData);
    onClose();
  };

  const handleDurationChange = (value: string) => {
    const parsedValue = parseInt(value);
    if (isNaN(parsedValue) || parsedValue < 0) {
      setDuration(undefined);
    } else {
      setDuration(parsedValue);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'Add New Task'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskName" className="text-right">
              Task Name
            </Label>
            <Input
              id="taskName"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="col-span-3"
              placeholder="Enter task name"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="predecessors" className="text-right">
              Predecessors
            </Label>
            <Input
              id="predecessors"
              value={predecessors}
              onChange={(e) => setPredecessors(e.target.value)}
              className="col-span-3"
              placeholder="Enter SI numbers (comma-separated)"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Start Date</Label>
            <div className="col-span-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    {startDate ? format(startDate, 'PP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <Label htmlFor="duration" className="text-right">
              Duration
            </Label>
            <Input
              id="duration"
              type="number"
              min="0"
              value={duration === undefined ? '' : duration}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="col-span-1"
              placeholder="Days"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">End Date</Label>
            <div className="col-span-3">
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                disabled
              >
                {endDate ? format(endDate, 'PP') : 'Calculated from start date and duration'}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stage" className="text-right">
              Stage *
            </Label>
            <Select
              value={stage}
              onValueChange={setStage}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product" className="text-right">
              Product
            </Label>
            <Input
              id="product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="col-span-3"
              placeholder="Enter product name"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Options</Label>
            <div className="col-span-3 flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="isMilestone" 
                  checked={isMilestone}
                  onCheckedChange={(checked) => setIsMilestone(checked === true)}
                />
                <Label htmlFor="isMilestone" className="cursor-pointer">
                  Milestone
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="isFinancialMilestone" 
                  checked={isFinancialMilestone}
                  onCheckedChange={(checked) => setIsFinancialMilestone(checked === true)}
                />
                <Label htmlFor="isFinancialMilestone" className="cursor-pointer">
                  Financial Milestone
                </Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEdit ? 'Update' : 'Add'} Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}