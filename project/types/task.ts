export interface Remark {
  id: string;
  content: string;
  date: Date;
  author: string;
  response?: {
    text: string;
    author: string;
    timestamp: Date;
  };
}

export interface Stage {
  id: string;
  name: string;
  colorCode: string;
}

export interface Product {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  siNo: number;
  wbsNo: string;
  taskName: string;
  predecessorIds: string | null;
  level: number;
  goLive: boolean;
  financialMilestone: boolean;
  startDate: Date | null;
  endDate: Date | null;
  duration: number | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  actualDuration: number | null;
  progress: number; // Float value representing percentage (0-100)
  view: 'Internal' | 'External';
  remarks: Remark[];
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  stageId?: string;
  productId?: string;
  isParent?: boolean;
}

export type TaskUpdate = Partial<Task>;

export interface Template {
  id: string;
  name: string;
  tasks: Task[];
  createdAt: Date;
}

// Predefined stages
export const STAGES: Stage[] = [
  { id: '1', name: 'Initiation', colorCode: '#FF5733' },
  { id: '2', name: 'Requirement Gathering', colorCode: '#33A8FF' },
  { id: '3', name: 'Design', colorCode: '#33FF57' },
  { id: '4', name: 'Development', colorCode: '#B533FF' },
  { id: '5', name: 'Testing', colorCode: '#FFD633' },
  { id: '6', name: 'Training', colorCode: '#33FFEC' },
  { id: '7', name: 'User Acceptance', colorCode: '#FF33A8' },
  { id: '8', name: 'Deployment', colorCode: '#33FF94' },
  { id: '9', name: 'Hypercare', colorCode: '#FF8C33' },
  { id: '10', name: 'Support Transition', colorCode: '#6E33FF' }
];

// Predefined products
export const PRODUCTS: Product[] = [
  { id: '1', name: 'VC' },
  { id: '2', name: 'Auc' },
  { id: '3', name: 'Inp-IB' },
  { id: '4', name: 'Inp-OB' },
  { id: '5', name: 'SmartL' },
  { id: '6', name: 'Freight' },
  { id: '7', name: 'Epod' }
];