import { Department, Employee, Role, TaskAssignment } from '@/types/employee';
import { generateRandomColor } from '@/lib/utils';

// Roles
export const roles: Role[] = [
  // Engineering roles
  { id: '101', name: 'Software Engineer', code: 'SE', departmentId: '1' },
  { id: '102', name: 'Solution Architect', code: 'SA', departmentId: '1' },
  { id: '103', name: 'Technical Lead', code: 'TL', departmentId: '1' },
  
  // Design roles
  { id: '201', name: 'UI Designer', code: 'UID', departmentId: '2' },
  { id: '202', name: 'UX Researcher', code: 'UXR', departmentId: '2' },
  
  // Marketing roles
  { id: '301', name: 'Marketing Specialist', code: 'MS', departmentId: '3' },
  { id: '302', name: 'Content Writer', code: 'CW', departmentId: '3' },
  
  // Sales roles
  { id: '401', name: 'Sales Representative', code: 'SR', departmentId: '4' },
  { id: '402', name: 'Account Manager', code: 'AM', departmentId: '4' },
  
  // Operations roles
  { id: '501', name: 'Operations Manager', code: 'OM', departmentId: '5' },
  { id: '502', name: 'Business Analyst', code: 'BA', departmentId: '5' },
  
  // Finance roles
  { id: '601', name: 'Financial Analyst', code: 'FA', departmentId: '6' },
  { id: '602', name: 'Accountant', code: 'ACC', departmentId: '6' },
  
  // HR roles
  { id: '701', name: 'HR Specialist', code: 'HRS', departmentId: '7' },
  { id: '702', name: 'Recruiter', code: 'REC', departmentId: '7' },
  
  // Product roles
  { id: '801', name: 'Product Manager', code: 'PM', departmentId: '8' },
  { id: '802', name: 'Program Manager', code: 'PRGM', departmentId: '8' },
  { id: '803', name: 'Functional Consultant', code: 'FC', departmentId: '8' }
];

// Departments
export const departments: Department[] = [
  { id: '1', name: 'Engineering', color: '#3b82f6' },
  { id: '2', name: 'Design', color: '#8b5cf6' },
  { id: '3', name: 'Marketing', color: '#10b981' },
  { id: '4', name: 'Sales', color: '#f59e0b' },
  { id: '5', name: 'Operations', color: '#ef4444' },
  { id: '6', name: 'Finance', color: '#6366f1' },
  { id: '7', name: 'HR', color: '#ec4899' },
  { id: '8', name: 'Product', color: '#14b8a6' }
];

// Employees
export const employees: Employee[] = [
  { id: '1', name: 'John Smith', email: 'john.smith@example.com', departmentId: '1', roleId: '102' },
  { id: '2', name: 'Emily Johnson', email: 'emily.johnson@example.com', departmentId: '2', roleId: '201' },
  { id: '3', name: 'Michael Brown', email: 'michael.brown@example.com', departmentId: '1', roleId: '101' },
  { id: '4', name: 'Sarah Davis', email: 'sarah.davis@example.com', departmentId: '3', roleId: '301' },
  { id: '5', name: 'David Wilson', email: 'david.wilson@example.com', departmentId: '4', roleId: '401' },
  { id: '6', name: 'Jessica Taylor', email: 'jessica.taylor@example.com', departmentId: '2', roleId: '202' },
  { id: '7', name: 'James Anderson', email: 'james.anderson@example.com', departmentId: '5', roleId: '501' },
  { id: '8', name: 'Jennifer Thomas', email: 'jennifer.thomas@example.com', departmentId: '6', roleId: '601' },
  { id: '9', name: 'Robert Jackson', email: 'robert.jackson@example.com', departmentId: '1', roleId: '103' },
  { id: '10', name: 'Lisa White', email: 'lisa.white@example.com', departmentId: '7', roleId: '701' },
  { id: '11', name: 'Daniel Harris', email: 'daniel.harris@example.com', departmentId: '8', roleId: '801' },
  { id: '12', name: 'Michelle Martin', email: 'michelle.martin@example.com', departmentId: '3', roleId: '302' },
  { id: '13', name: 'William Thompson', email: 'william.thompson@example.com', departmentId: '4', roleId: '402' },
  { id: '14', name: 'Elizabeth Garcia', email: 'elizabeth.garcia@example.com', departmentId: '5', roleId: '502' },
  { id: '15', name: 'Richard Martinez', email: 'richard.martinez@example.com', departmentId: '1', roleId: '101' },
  { id: '16', name: 'Patricia Robinson', email: 'patricia.robinson@example.com', departmentId: '8', roleId: '802' },
  { id: '17', name: 'Charles Clark', email: 'charles.clark@example.com', departmentId: '8', roleId: '803' }
];

// Initial task assignments (empty)
export const initialTaskAssignments: Record<string, TaskAssignment[]> = {};

// Helper function to get department by ID
export function getDepartmentById(id: string): Department | undefined {
  return departments.find(dept => dept.id === id);
}

// Helper function to get employee by ID
export function getEmployeeById(id: string): Employee | undefined {
  return employees.find(emp => emp.id === id);
}

// Helper function to get role by ID
export function getRoleById(id: string): Role | undefined {
  return roles.find(role => role.id === id);
}

// Helper function to get roles by department ID
export function getRolesByDepartmentId(departmentId: string): Role[] {
  return roles.filter(role => role.departmentId === departmentId);
}

// Helper function to get employees by department
export function getEmployeesByDepartment(departmentId: string): Employee[] {
  return employees.filter(emp => emp.departmentId === departmentId);
}

// Helper function to get employees by role
export function getEmployeesByRole(roleId: string): Employee[] {
  return employees.filter(emp => emp.roleId === roleId);
}

// Helper function to get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
}