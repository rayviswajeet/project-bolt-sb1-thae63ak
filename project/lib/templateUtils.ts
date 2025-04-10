import { Task } from '@/types/task';

// Type definitions for templates
export interface Template {
  id: string;
  name: string;
  createdAt: Date;
  tasks: TemplateTask[];
}

export interface TemplateTask {
  id: string;
  siNo: number;
  wbsNo: string;
  taskName: string;
  predecessorIds: string | null;
  level: number;
  goLive: boolean;
  financialMilestone: boolean;
  duration: number | null;
  view: 'Internal' | 'External';
  stageId?: string;
  productId?: string;
  isParent?: boolean;
}

// The storage key for templates in localStorage
const TEMPLATES_STORAGE_KEY = 'project_templates';

/**
 * Saves all templates to localStorage
 * @param templates Array of templates to save
 */
export function saveTemplatesToStorage(templates: Template[]): void {
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

/**
 * Loads all templates from localStorage
 * @returns Array of templates
 */
export function loadTemplatesFromStorage(): Template[] {
  const templatesJson = localStorage.getItem(TEMPLATES_STORAGE_KEY);
  if (!templatesJson) return [];
  
  try {
    return JSON.parse(templatesJson).map((template: any) => ({
      ...template,
      createdAt: new Date(template.createdAt)
    }));
  } catch (error) {
    console.error('Failed to parse templates from storage:', error);
    return [];
  }
}

/**
 * Creates a new template from tasks
 * @param name The name of the template
 * @param tasks Array of tasks to create template from
 * @returns The newly created template
 */
export function createTemplate(name: string, tasks: Task[]): Template {
  // Filter out deleted tasks
  const visibleTasks = tasks.filter(task => !task.isDeleted);
  
  // Convert tasks to template tasks (exclude fields we don't want to save)
  const templateTasks: TemplateTask[] = visibleTasks.map(task => ({
    id: task.id,
    siNo: task.siNo,
    wbsNo: task.wbsNo,
    taskName: task.taskName,
    predecessorIds: task.predecessorIds,
    level: task.level,
    goLive: task.goLive,
    financialMilestone: task.financialMilestone,
    duration: task.duration,
    view: task.view,
    stageId: task.stageId,
    productId: task.productId,
    isParent: task.isParent
  }));
  
  // Create and return the template
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date(),
    tasks: templateTasks
  };
}

/**
 * Saves a template to localStorage
 * @param template The template to save
 * @returns Array of all templates including the newly saved one
 */
export function saveTemplate(template: Template): Template[] {
  const templates = loadTemplatesFromStorage();
  const updatedTemplates = [...templates, template];
  saveTemplatesToStorage(updatedTemplates);
  return updatedTemplates;
}

/**
 * Deletes a template from localStorage
 * @param templateId The ID of the template to delete
 * @returns Array of remaining templates
 */
export function deleteTemplate(templateId: string): Template[] {
  const templates = loadTemplatesFromStorage();
  const updatedTemplates = templates.filter(t => t.id !== templateId);
  saveTemplatesToStorage(updatedTemplates);
  return updatedTemplates;
}

/**
 * Converts template tasks back to regular tasks
 * @param templateTasks Array of template tasks
 * @returns Array of tasks with default values for unsaved fields
 */
export function convertTemplateTasks(templateTasks: TemplateTask[]): Task[] {
  return templateTasks.map(templateTask => ({
    id: crypto.randomUUID(), // Generate new IDs for each task
    siNo: templateTask.siNo,
    wbsNo: templateTask.wbsNo,
    taskName: templateTask.taskName,
    predecessorIds: templateTask.predecessorIds,
    level: templateTask.level,
    goLive: templateTask.goLive,
    financialMilestone: templateTask.financialMilestone,
    startDate: null,  // Reset date fields
    endDate: null,
    duration: templateTask.duration,
    actualStartDate: null,
    actualEndDate: null,
    actualDuration: null,
    progress: 0, // Reset progress
    view: templateTask.view,
    remarks: [], // Reset remarks
    createdAt: new Date(),
    updatedAt: new Date(),
    stageId: templateTask.stageId,
    productId: templateTask.productId,
    isParent: templateTask.isParent,
    isDeleted: false
  }));
}
