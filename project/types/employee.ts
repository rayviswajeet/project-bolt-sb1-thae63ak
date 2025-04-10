export interface Department {
    id: string;
    name: string;
    color: string;
    roles?: Role[];
  }
  
  export interface Role {
    id: string;
    name: string;
    code: string;
    departmentId: string;
  }
  
  export interface Employee {
    id: string;
    name: string;
    email: string;
    departmentId: string;
    roleId?: string;
    avatar?: string;
  }
  
  export interface TaskAssignment {
    taskId: string;
    employeeId: string;
    percentage: number;
    remarks?: string;
  }