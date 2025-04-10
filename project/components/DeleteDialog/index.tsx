'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { useTaskStore } from '@/store/taskStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { validatePredecessors } from '@/lib/taskUtils';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Info } from 'lucide-react';

interface DeleteDialogProps {
  tasks: Task[];
  onClose: () => void;
}

export default function DeleteDialog({ tasks, onClose }: DeleteDialogProps) {
  const { tasks: allTasks, updateTask, bulkDeleteTasks } = useTaskStore();
  const { toast } = useToast();
  
  // Find tasks that depend on the tasks being deleted
  const [dependentTasks, setDependentTasks] = useState<Task[]>([]);
  
  // Track predecessor updates for each dependent task
  const [predecessorUpdates, setPredecessorUpdates] = useState<Record<string, string>>({});
  
  // Track validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  
  // Initialize dependent tasks and predecessor updates
  useEffect(() => {
    if (tasks.length === 0) return;
    
    // Get SI numbers of tasks to be deleted
    const taskSiNos = tasks.map(t => t.siNo);
    
    // Find tasks that depend on any of the tasks being deleted
    const dependents = allTasks.filter(t => 
      !t.isDeleted && 
      !tasks.some(deleteTask => deleteTask.id === t.id) && // Exclude tasks being deleted
      t.predecessorIds?.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id))
        .some(id => taskSiNos.includes(id))
    );
    
    setDependentTasks(dependents);
    
    // Initialize predecessor updates by removing the to-be-deleted tasks
    const updates: Record<string, string> = {};
    
    dependents.forEach(task => {
      if (!task.predecessorIds) return;
      
      // Filter out the SI numbers of tasks being deleted
      const updatedPredecessors = task.predecessorIds
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id) && !taskSiNos.includes(id))
        .join(',');
      
      updates[task.id] = updatedPredecessors;
    });
    
    setPredecessorUpdates(updates);
  }, [tasks, allTasks]);
  
  // Handle predecessor input change
  const handlePredecessorChange = (taskId: string, value: string) => {
    setPredecessorUpdates(prev => ({ ...prev, [taskId]: value }));
    
    // Validate the new predecessors
    const task = dependentTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const errors = validatePredecessors(task, value, allTasks);
    
    setValidationErrors(prev => ({
      ...prev,
      [taskId]: errors
    }));
  };
  
  // Check if all dependencies are resolved
  const hasUnresolvedDependencies = () => {
    // Check if any dependent task has validation errors
    const hasErrors = Object.values(validationErrors).some(errors => errors.length > 0);
    if (hasErrors) return true;
    
    // All dependencies must be updated
    return dependentTasks.some(task => 
      !predecessorUpdates[task.id] && task.predecessorIds
    );
  };
  
  // Handle deletion with dependency updates
  const handleDelete = () => {
    if (hasUnresolvedDependencies()) {
      toast({
        title: "Cannot Delete Tasks",
        description: "Please resolve all dependency issues before deleting",
        variant: "destructive"
      });
      return;
    }
    
    // First update all dependent tasks with new predecessor values
    Object.entries(predecessorUpdates).forEach(([taskId, predecessorIds]) => {
      updateTask(taskId, { predecessorIds });
    });
    
    // Then delete the selected tasks
    const taskIds = tasks.map(task => task.id);
    bulkDeleteTasks(taskIds);
    
    toast({
      title: "Tasks Deleted",
      description: `Successfully deleted ${tasks.length} task(s)`,
      variant: "default"
    });
    
    onClose();
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Confirm Deletion</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[70vh] overflow-y-auto py-4">
          {/* Tasks to delete */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Tasks to Delete ({tasks.length})
            </h3>
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <ul className="space-y-1">
                {tasks.map(task => (
                  <li key={task.id} className="flex items-center gap-2">
                    <span className="text-gray-500 w-10 text-right">{task.siNo}.</span>
                    <span className={task.level === 0 ? "font-bold" : ""}>
                      {task.taskName || `<task${task.siNo}>`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Dependent tasks */}
          {dependentTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                Dependent Tasks ({dependentTasks.length})
              </h3>
              <p className="text-sm text-gray-600">
                The following tasks depend on tasks you're deleting. 
                Please update their predecessors before continuing.
              </p>
              
              <div className="space-y-3">
                {dependentTasks.map(task => (
                  <div key={task.id} className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-500 w-10 text-right">{task.siNo}.</span>
                      <span className={task.level === 0 ? "font-bold" : ""}>
                        {task.taskName || `<task${task.siNo}>`}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <label className="text-sm text-gray-600 w-32">Current predecessors:</label>
                        <span className="text-sm font-medium">{task.predecessorIds || 'None'}</span>
                      </div>
                      
                      <div className="flex gap-2 items-center">
                        <label className="text-sm text-gray-600 w-32">New predecessors:</label>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={predecessorUpdates[task.id] || ''}
                            onChange={(e) => handlePredecessorChange(task.id, e.target.value)}
                            className={`w-full px-3 py-1.5 text-sm border rounded-md ${
                              validationErrors[task.id]?.length ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="Enter SI numbers (comma-separated)"
                          />
                          
                          {validationErrors[task.id]?.length > 0 && (
                            <div className="mt-1 text-xs text-red-500">
                              {validationErrors[task.id].map((error, i) => (
                                <div key={i}>{error}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between items-center pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={hasUnresolvedDependencies()}
          >
            Delete {tasks.length} Task{tasks.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}