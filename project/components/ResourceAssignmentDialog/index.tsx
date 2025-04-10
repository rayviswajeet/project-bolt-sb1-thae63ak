'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEmployeeStore } from '@/store/employeeStore';
import { Employee, Department, Role, TaskAssignment } from '@/types/employee';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import { getInitials, getRoleById } from '@/data/employees';
import { cn, stringToColor } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import AssignmentPercentageDialog from '@/components/AssignmentPercentageDialog';

interface ResourceAssignmentDialogProps {
  taskId: string;
  taskName: string;
  onClose: () => void;
}

export default function ResourceAssignmentDialog({ 
  taskId, 
  taskName,
  onClose 
}: ResourceAssignmentDialogProps) {
  const { 
    employees, 
    departments, 
    roles,
    getTaskAssignments,
    getRolesByDepartment
  } = useEmployeeStore();
  
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  
  // Get department roles
  const departmentRoles = selectedDepartment 
    ? getRolesByDepartment(selectedDepartment)
    : [];
  
  // Initialize selected employees from current assignments
  useEffect(() => {
    const assignments = getTaskAssignments(taskId);
    setSelectedEmployees(assignments.map(a => a.employeeId));
  }, [taskId, getTaskAssignments]);
  
  // Filter employees based on search, department and role
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = searchTerm === '' || 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = selectedDepartment === null || 
      employee.departmentId === selectedDepartment;
    
    const matchesRole = selectedRole === null ||
      employee.roleId === selectedRole;
    
    return matchesSearch && matchesDepartment && matchesRole;
  });
  
  // Toggle employee selection
  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };
  
  // Handle save
  const handleSave = () => {
    if (selectedEmployees.length === 0) {
      onClose();
      return;
    }
    
    // Open assignment percentage dialog
    setShowAssignmentDialog(true);
  };
  
  // Get department by ID
  const getDepartment = (departmentId: string): Department | undefined => {
    return departments.find(dept => dept.id === departmentId);
  };
  
  // Reset role when department changes
  useEffect(() => {
    setSelectedRole(null);
  }, [selectedDepartment]);
  
  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Assign Resources</DialogTitle>
          </DialogHeader>
          
          <div className="mb-4">
            <p className="text-sm text-gray-500">
              Task: <span className="font-medium text-gray-700">{taskName}</span>
            </p>
          </div>
          
          <div className="space-y-4">
            {/* Search and filter */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  className="pl-8 pr-4 py-2 w-full border rounded-md text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    className="absolute right-2 top-2.5"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
              
              {/* Department filter */}
              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(
                    "px-3 py-1 text-xs rounded-full border",
                    selectedDepartment === null 
                      ? "bg-gray-200 border-gray-300" 
                      : "bg-white border-gray-200 text-gray-700"
                  )}
                  onClick={() => setSelectedDepartment(null)}
                >
                  All Departments
                </button>
                
                {departments.map(dept => (
                  <button
                    key={dept.id}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full border",
                      selectedDepartment === dept.id 
                        ? "bg-gray-200 border-gray-300" 
                        : "bg-white border-gray-200 text-gray-700"
                    )}
                    onClick={() => setSelectedDepartment(prev => 
                      prev === dept.id ? null : dept.id
                    )}
                    style={{
                      borderColor: dept.color,
                      backgroundColor: selectedDepartment === dept.id 
                        ? `${dept.color}20` // 20% opacity
                        : 'white'
                    }}
                  >
                    {dept.name}
                  </button>
                ))}
              </div>
              
              {/* Role filter - only show when department is selected */}
              {selectedDepartment && departmentRoles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    className={cn(
                      "px-3 py-1 text-xs rounded-full border",
                      selectedRole === null 
                        ? "bg-gray-200 border-gray-300" 
                        : "bg-white border-gray-200 text-gray-700"
                    )}
                    onClick={() => setSelectedRole(null)}
                  >
                    All Roles
                  </button>
                  
                  {departmentRoles.map(role => (
                    <button
                      key={role.id}
                      className={cn(
                        "px-3 py-1 text-xs rounded-full border",
                        selectedRole === role.id 
                          ? "bg-gray-200 border-gray-300" 
                          : "bg-white border-gray-200 text-gray-700"
                      )}
                      onClick={() => setSelectedRole(prev => 
                        prev === role.id ? null : role.id
                      )}
                    >
                      {role.name} ({role.code})
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Employee list */}
            <div className="border rounded-md overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No employees found
                  </div>
                ) : (
                  <ul className="divide-y">
                    {filteredEmployees.map(employee => {
                      const department = getDepartment(employee.departmentId);
                      const role = getRoleById(employee.roleId || '');
                      const isSelected = selectedEmployees.includes(employee.id);
                      
                      return (
                        <li 
                          key={employee.id}
                          className={cn(
                            "flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50",
                            isSelected && "bg-blue-50 hover:bg-blue-50"
                          )}
                          onClick={() => toggleEmployee(employee.id)}
                        >
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
                              <div className="flex items-center gap-2">
                                <span 
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: department?.color || '#ccc' }}
                                />
                                <p className="text-xs text-gray-500">
                                  {department?.name}
                                  {role && ` • ${role.name} (${role.code})`}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center",
                            isSelected 
                              ? "bg-blue-500 border-blue-500" 
                              : "border-gray-300"
                          )}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            
            {/* Selected count */}
            <div className="text-sm text-gray-500">
              {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} selected
            </div>
          </div>
          
          <DialogFooter className="flex justify-between items-center pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {selectedEmployees.length > 0 ? 'Continue to Assignment' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {showAssignmentDialog && (
        <AssignmentPercentageDialog
          taskId={taskId}
          taskName={taskName}
          selectedEmployeeIds={selectedEmployees}
          onClose={() => {
            setShowAssignmentDialog(false);
            onClose();
          }}
        />
      )}
    </>
  );
}