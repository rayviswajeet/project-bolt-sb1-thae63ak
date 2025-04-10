'use client';

import { useState } from 'react';
import { useEmployeeStore } from '@/store/employeeStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/data/employees';
import { stringToColor } from '@/lib/utils';
import ResourceAssignmentDialog from '@/components/ResourceAssignmentDialog';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ResourceCellProps {
  taskId: string;
  taskName: string;
}

export default function ResourceCell({ taskId, taskName }: ResourceCellProps) {
  const [showDialog, setShowDialog] = useState(false);
  const { getAssignedEmployees, getTaskAssignments } = useEmployeeStore();
  
  const assignedEmployees = getAssignedEmployees(taskId);
  const assignments = getTaskAssignments(taskId);
  
  return (
    <>
      <div 
        className="flex items-center gap-1 overflow-hidden cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
        onDoubleClick={() => setShowDialog(true)}
      >
        {assignedEmployees.length === 0 ? (
          <div className="flex items-center text-gray-400 text-xs">
            <Plus className="w-3 h-3 mr-1" />
            <span>Assign</span>
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex -space-x-2 overflow-hidden">
                  {assignedEmployees.slice(0, 3).map((employee, index) => {
                    const assignment = assignments.find(a => a.employeeId === employee.id);
                    return (
                      <Avatar 
                        key={employee.id} 
                        className={cn(
                          "h-6 w-6 border border-white",
                          index > 0 && "-ml-2"
                        )}
                      >
                        <AvatarFallback 
                          className="text-[10px]"
                          style={{ 
                            backgroundColor: stringToColor(employee.name),
                            color: 'white'
                          }}
                        >
                          {getInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                  
                  {assignedEmployees.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-gray-200 border border-white -ml-2 flex items-center justify-center text-[10px] text-gray-600">
                      +{assignedEmployees.length - 3}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="p-2 max-w-xs z-[40]">
                <div className="space-y-1.5">
                  {assignments.map(assignment => {
                    const employee = assignedEmployees.find(e => e.id === assignment.employeeId);
                    if (!employee) return null;
                    return (
                      <div key={assignment.employeeId} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{employee.name}</span>
                          <span className="ml-2 text-gray-500">{assignment.percentage}%</span>
                        </div>
                        {assignment.remarks && (
                          <div className="text-xs text-gray-600 pl-2 whitespace-pre-line">
                            {assignment.remarks}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {showDialog && (
        <ResourceAssignmentDialog
          taskId={taskId}
          taskName={taskName}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}