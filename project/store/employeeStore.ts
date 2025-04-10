import { create } from 'zustand';
import { Employee, Department, TaskAssignment, Role } from '@/types/employee';
import { employees, departments, initialTaskAssignments, roles, getRolesByDepartmentId } from '@/data/employees';

interface EmployeeState {
  employees: Employee[];
  departments: Department[];
  roles: Role[];
  taskAssignments: Record<string, TaskAssignment[]>; // taskId -> TaskAssignment[]
  
  // Actions
  assignEmployeeToTask: (taskId: string, assignment: TaskAssignment) => void;
  removeEmployeeFromTask: (taskId: string, employeeId: string) => void;
  getTaskAssignments: (taskId: string) => TaskAssignment[];
  getAssignedEmployees: (taskId: string) => Employee[];
  clearTaskAssignments: (taskId: string) => void;
  bulkAssignEmployeesToTask: (taskId: string, assignments: TaskAssignment[]) => void;
  getRolesByDepartment: (departmentId: string) => Role[];
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees,
  departments,
  roles,
  taskAssignments: initialTaskAssignments,
  
  assignEmployeeToTask: (taskId, assignment) => {
    set(state => {
      const currentAssignments = state.taskAssignments[taskId] || [];
      
      // Check if employee is already assigned
      const existingIndex = currentAssignments.findIndex(a => a.employeeId === assignment.employeeId);
      
      if (existingIndex >= 0) {
        // Update existing assignment
        const updatedAssignments = [...currentAssignments];
        updatedAssignments[existingIndex] = assignment;
        
        return {
          taskAssignments: {
            ...state.taskAssignments,
            [taskId]: updatedAssignments
          }
        };
      } else {
        // Add new assignment
        return {
          taskAssignments: {
            ...state.taskAssignments,
            [taskId]: [...currentAssignments, assignment]
          }
        };
      }
    });
  },
  
  removeEmployeeFromTask: (taskId, employeeId) => {
    set(state => {
      const currentAssignments = state.taskAssignments[taskId] || [];
      
      return {
        taskAssignments: {
          ...state.taskAssignments,
          [taskId]: currentAssignments.filter(a => a.employeeId !== employeeId)
        }
      };
    });
  },
  
  getTaskAssignments: (taskId) => {
    return get().taskAssignments[taskId] || [];
  },
  
  getAssignedEmployees: (taskId) => {
    const { employees, taskAssignments } = get();
    const assignments = taskAssignments[taskId] || [];
    
    return assignments.map(assignment => {
      const employee = employees.find(emp => emp.id === assignment.employeeId);
      return employee!;
    }).filter(Boolean);
  },
  
  clearTaskAssignments: (taskId) => {
    set(state => {
      const { [taskId]: _, ...rest } = state.taskAssignments;
      return { taskAssignments: rest };
    });
  },
  
  bulkAssignEmployeesToTask: (taskId, assignments) => {
    // Ensure all assignments have valid percentage values
    const validatedAssignments = assignments.map(assignment => ({
      ...assignment,
      percentage: assignment.percentage || 0
    }));
    
    set(state => ({
      taskAssignments: {
        ...state.taskAssignments,
        [taskId]: validatedAssignments
      }
    }));
  },
  
  getRolesByDepartment: (departmentId) => {
    return getRolesByDepartmentId(departmentId);
  }
}));