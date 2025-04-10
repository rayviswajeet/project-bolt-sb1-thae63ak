'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEmployeeStore } from '@/store/employeeStore';
import { TaskAssignment } from '@/types/employee';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, getRoleById } from '@/data/employees';
import { cn, stringToColor } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, List, ListOrdered } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface AssignmentPercentageDialogProps {
  taskId: string;
  taskName: string;
  selectedEmployeeIds: string[];
  onClose: () => void;
}

export default function AssignmentPercentageDialog({
  taskId,
  taskName,
  selectedEmployeeIds,
  onClose
}: AssignmentPercentageDialogProps) {
  const { employees, getTaskAssignments, bulkAssignEmployeesToTask } = useEmployeeStore();
  const { toast } = useToast();
  
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [totalPercentage, setTotalPercentage] = useState(0);
  const [remarkFormats, setRemarkFormats] = useState<Record<string, 'none' | 'numbered' | 'bulleted'>>({});
  
  // Initialize assignments
  useEffect(() => {
    if (selectedEmployeeIds.length === 0) return;
    
    const existingAssignments = getTaskAssignments(taskId);
    const equalPercentage = Math.floor(100 / selectedEmployeeIds.length);
    const remainder = 100 - (equalPercentage * selectedEmployeeIds.length);
    
    // Create initial assignments
    const initialAssignments = selectedEmployeeIds.map((employeeId, index) => {
      const existing = existingAssignments.find(a => a.employeeId === employeeId);
      return {
        taskId,
        employeeId,
        percentage: existing?.percentage ?? (index === 0 ? equalPercentage + remainder : equalPercentage),
        remarks: existing?.remarks || ''
      };
    });
    
    setAssignments(initialAssignments);
    
    // Initialize input values
    const initialInputValues: Record<string, string> = {};
    const initialFormats: Record<string, 'none' | 'numbered' | 'bulleted'> = {};
    
    initialAssignments.forEach(assignment => {
      initialInputValues[`percentage_${assignment.employeeId}`] = assignment.percentage.toString();
      initialInputValues[`remarks_${assignment.employeeId}`] = assignment.remarks || '';
      
      // Detect format from existing remarks
      let format: 'none' | 'numbered' | 'bulleted' = 'none';
      if (assignment.remarks) {
        const firstLine = assignment.remarks.split('\n')[0] || '';
        if (firstLine.match(/^\d+\.\s/)) format = 'numbered';
        else if (firstLine.match(/^•\s/)) format = 'bulleted';
      }
      initialFormats[assignment.employeeId] = format;
    });
    
    setInputValues(initialInputValues);
    setRemarkFormats(initialFormats);
    updateTotalPercentage(initialAssignments);
  }, [selectedEmployeeIds, taskId, getTaskAssignments]);
  
  // Update total percentage
  const updateTotalPercentage = (currentAssignments: TaskAssignment[]) => {
    const total = currentAssignments.reduce((sum, a) => sum + (a.percentage || 0), 0);
    setTotalPercentage(total);
    
    // Set global error if total is not 100%
    if (total !== 100) {
      setErrors(prev => ({...prev, _global: `Total allocation must be 100%. Current: ${total}%`}));
    } else {
      setErrors(prev => {
        const { _global, ...rest } = prev;
        return rest;
      });
    }
  };
  
  // Handle percentage input change
  const handlePercentageChange = (employeeId: string, value: string) => {
    // Always update the input value
    setInputValues(prev => ({...prev, [`percentage_${employeeId}`]: value}));
    
    // Skip validation for empty or partial inputs
    if (value === '' || value === '-') {
      setErrors(prev => ({...prev, [employeeId]: ''}));
      return;
    }
    
    const percentage = parseInt(value);
    if (isNaN(percentage)) {
      setErrors(prev => ({...prev, [employeeId]: 'Must be a number'}));
      return;
    }
    
    // Validate percentage
    let error = '';
    if (percentage < 0) error = 'Must be a positive number';
    else if (percentage > 100) error = 'Cannot exceed 100%';
    
    setErrors(prev => ({...prev, [employeeId]: error}));
    
    // Only update if valid
    if (!error) {
      const updatedAssignments = assignments.map(a => 
        a.employeeId === employeeId ? {...a, percentage} : a
      );
      
      setAssignments(updatedAssignments);
      updateTotalPercentage(updatedAssignments);
      
      // Auto-balance for exactly 2 employees
      if (selectedEmployeeIds.length === 2) {
        const otherEmployeeId = selectedEmployeeIds.find(id => id !== employeeId);
        if (otherEmployeeId) {
          const remainingPercentage = 100 - percentage;
          
          // Update the other employee's percentage
          const balancedAssignments = updatedAssignments.map(a => 
            a.employeeId === otherEmployeeId ? {...a, percentage: remainingPercentage} : a
          );
          
          setAssignments(balancedAssignments);
          updateTotalPercentage(balancedAssignments);
          
          // Update input value for the other employee
          setInputValues(prev => ({
            ...prev, 
            [`percentage_${otherEmployeeId}`]: remainingPercentage.toString()
          }));
        }
      }
    }
  };
  
  // Handle percentage blur
  const handlePercentageBlur = (employeeId: string) => {
    const value = inputValues[`percentage_${employeeId}`] || '0';
    
    // Reset invalid values to 0
    if (value === '' || value === '-' || isNaN(parseInt(value))) {
      setInputValues(prev => ({...prev, [`percentage_${employeeId}`]: '0'}));
      
      const updatedAssignments = assignments.map(a => 
        a.employeeId === employeeId ? {...a, percentage: 0} : a
      );
      
      setAssignments(updatedAssignments);
      updateTotalPercentage(updatedAssignments);
    }
  };
  
  // Handle remarks change
  const handleRemarksChange = (employeeId: string, value: string) => {
    setInputValues(prev => ({...prev, [`remarks_${employeeId}`]: value}));
    setAssignments(prev => 
      prev.map(a => a.employeeId === employeeId ? {...a, remarks: value} : a)
    );
  };
  
  // Handle format change
  const handleFormatChange = (employeeId: string, format: 'none' | 'numbered' | 'bulleted') => {
    setRemarkFormats(prev => ({...prev, [employeeId]: format}));
    
    const currentRemarks = inputValues[`remarks_${employeeId}`] || '';
    
    // Remove existing formatting
    const cleanRemarks = currentRemarks
      .split('\n')
      .map(line => line.replace(/^(\d+\.\s|\•\s)/, ''))
      .join('\n');
    
    // Apply new formatting
    let formattedRemarks = cleanRemarks;
    if (format === 'numbered') {
      formattedRemarks = cleanRemarks
        .split('\n')
        .filter(line => line.trim())
        .map((line, i) => `${i + 1}. ${line}`)
        .join('\n');
    } else if (format === 'bulleted') {
      formattedRemarks = cleanRemarks
        .split('\n')
        .filter(line => line.trim())
        .map(line => `• ${line}`)
        .join('\n');
    }
    
    setInputValues(prev => ({...prev, [`remarks_${employeeId}`]: formattedRemarks}));
    setAssignments(prev => 
      prev.map(a => a.employeeId === employeeId ? {...a, remarks: formattedRemarks} : a)
    );
  };
  
  // Auto-balance percentages
  const autoBalance = () => {
    if (assignments.length <= 1 || totalPercentage === 100) return;
    
    const remaining = 100 - totalPercentage;
    const perEmployee = Math.floor(remaining / assignments.length);
    const remainder = remaining - (perEmployee * assignments.length);
    
    const updatedAssignments = assignments.map((a, index) => ({
      ...a,
      percentage: (a.percentage || 0) + perEmployee + (index === 0 ? remainder : 0)
    }));
    
    setAssignments(updatedAssignments);
    
    // Update input values
    updatedAssignments.forEach(a => {
      setInputValues(prev => ({
        ...prev, 
        [`percentage_${a.employeeId}`]: a.percentage.toString()
      }));
    });
    
    updateTotalPercentage(updatedAssignments);
  };
  
  // Check if form is valid
  const isFormValid = () => {
    return Object.values(errors).every(error => !error) && totalPercentage === 100;
  };
  
  // Handle save
  const handleSave = () => {
    if (!isFormValid()) {
      toast({
        title: "Invalid Assignments",
        description: errors._global || "Please fix the errors before saving",
        variant: "destructive"
      });
      return;
    }
    
    bulkAssignEmployeesToTask(taskId, assignments);
    
    toast({
      title: "Resources Assigned",
      description: `Successfully assigned ${assignments.length} resource(s) to the task`,
      variant: "default"
    });
    
    onClose();
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Resource Assignment Details</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4">
          <p className="text-sm text-gray-500">
            Task: <span className="font-medium text-gray-700">{taskName}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Please specify the percentage allocation for each resource. Total must equal 100%.
          </p>
          
          {/* Total percentage indicator */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-medium">Total Allocation:</span>
            <span className={cn(
              "text-sm font-bold",
              totalPercentage === 100 ? "text-green-600" : "text-red-500"
            )}>
              {totalPercentage}%
            </span>
          </div>
          
          {errors._global && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errors._global}
            </p>
          )}
          
          {totalPercentage !== 100 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 text-xs h-7"
              onClick={autoBalance}
            >
              Auto-Balance to 100%
            </Button>
          )}
        </div>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {assignments.map(assignment => {
            const employee = employees.find(e => e.id === assignment.employeeId);
            if (!employee) return null;
            
            const role = getRoleById(employee.roleId || '');
            
            return (
              <div key={assignment.employeeId} className="border rounded-md p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 border">
                    <AvatarFallback 
                      style={{ 
                        backgroundColor: stringToColor(employee.name),
                        color: 'white'
                      }}
                    >
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <p className="text-sm font-medium">{employee.name}</p>
                    <p className="text-xs text-gray-500">
                      {role ? `${role.name} (${role.code})` : 'No role assigned'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {/* Percentage input */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Assignment Percentage *
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={inputValues[`percentage_${assignment.employeeId}`] || ''}
                        onChange={(e) => handlePercentageChange(assignment.employeeId, e.target.value)}
                        onBlur={() => handlePercentageBlur(assignment.employeeId)}
                        className={cn(
                          "w-20 px-3 py-1.5 text-sm border rounded-md",
                          errors[assignment.employeeId] ? "border-red-500" : "border-gray-300"
                        )}
                        required
                      />
                      <span className="ml-2 text-sm text-gray-500">%</span>
                    </div>
                    {errors[assignment.employeeId] && (
                      <p className="mt-1 text-xs text-red-500 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors[assignment.employeeId]}
                      </p>
                    )}
                  </div>
                  
                  {/* Remarks input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">
                        Remarks (Optional)
                      </label>
                      
                      <ToggleGroup 
                        type="single" 
                        value={remarkFormats[assignment.employeeId] || 'none'}
                        onValueChange={(value) => {
                          if (value) handleFormatChange(assignment.employeeId, value as 'none' | 'numbered' | 'bulleted');
                        }}
                        className="border rounded-md"
                        size="sm"
                      >
                        <ToggleGroupItem value="none" className="h-6 w-6 p-0">
                          <span className="sr-only">None</span>
                          <span className="text-xs">T</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="numbered" className="h-6 w-6 p-0">
                          <span className="sr-only">Numbered List</span>
                          <ListOrdered className="h-3 w-3" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="bulleted" className="h-6 w-6 p-0">
                          <span className="sr-only">Bulleted List</span>
                          <List className="h-3 w-3" />
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    
                    <textarea
                      value={inputValues[`remarks_${assignment.employeeId}`] || ''}
                      onChange={(e) => handleRemarksChange(assignment.employeeId, e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md"
                      rows={3}
                      placeholder="Add any notes about this assignment"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <DialogFooter className="flex justify-between items-center pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!isFormValid()}
          >
            Assign Resources
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}