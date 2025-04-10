'use client';

import { useEffect, useState, useRef } from 'react';
import { Task } from '@/types/task';
import { useTaskStore } from '@/store/taskStore';
import TaskRow from './TaskRow';
import { List, AutoSizer } from 'react-virtualized';
import { Plus, CheckSquare, Trash2, Undo, Redo, ChevronRight, ChevronLeft, Diamond } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DeleteDialog from '@/components/DeleteDialog';
import { updateTaskLevelsForIndent, updateTaskLevelsForOutdent } from '@/lib/taskUtils';
import { ResizableTable, ResizableHeader } from '@/components/ui/resizable-table';

interface TaskTableProps {
  initialTasks: Task[];
}

export default function TaskTable({ initialTasks }: TaskTableProps) {
  const {
    tasks,
    setTasks,
    addTask,
    addTaskAfter,
    updateTask,
    bulkDeleteTasks,
    isSelecting,
    setSelecting,
    selectedIds,
    clearSelection,
    activeTaskId,
    setActiveTask,
    undo,
    redo
  } = useTaskStore();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  // Filter out deleted tasks for display
  const visibleTasks = tasks.filter(task => !task.isDeleted);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks, setTasks]);

  const handleAddTask = () => {
    // If there's an active task, add a task after it with the same level
    if (activeTaskId) {
      const activeTask = visibleTasks.find(t => t.id === activeTaskId);
      if (activeTask) {
        addTaskAfter(activeTaskId);
        return;
      }
    }

    // Otherwise, add a task at the end
    const lastTask = visibleTasks[visibleTasks.length - 1];
    const newSiNo = lastTask ? lastTask.siNo + 1 : 1;
    const newTask: Task = {
      id: crypto.randomUUID(),
      siNo: newSiNo,
      wbsNo: String(newSiNo),
      taskName: `<task${newSiNo}>`,
      predecessorIds: lastTask ? String(lastTask.siNo) : null,
      level: 0,
      isMilestone: false,
      startDate: new Date(),
      progress: 0,
      view: 'External',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    addTask(newTask);
    setActiveTask(newTask.id);
  };

  const handleDemote = () => {
    const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({
        title: "No Tasks Selected",
        description: "Please select tasks to demote",
        variant: "default"
      });
      return;
    }

    try {
      // Pass the full tasks array but only operate on visible tasks
      const updatedTasks = updateTaskLevelsForIndent(tasks, selectedIds);
      setTasks(updatedTasks);
      
      toast({
        title: "Tasks Demoted",
        description: `Successfully demoted ${selectedTasks.length} task(s)`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Cannot Demote",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handlePromote = () => {
    const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({
        title: "No Tasks Selected",
        description: "Please select tasks to promote",
        variant: "default"
      });
      return;
    }

    try {
      // Pass the full tasks array but only operate on visible tasks
      const updatedTasks = updateTaskLevelsForOutdent(tasks, selectedIds);
      setTasks(updatedTasks);
      
      toast({
        title: "Tasks Promoted",
        description: `Successfully promoted ${selectedTasks.length} task(s)`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Cannot Promote",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handleToggleMilestone = () => {
    const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({
        title: "No Tasks Selected",
        description: "Please select tasks to toggle milestone",
        variant: "default"
      });
      return;
    }

    selectedTasks.forEach(task => {
      updateTask(task.id, { isMilestone: !task.isMilestone });
    });
    
    toast({
      title: "Milestone Toggled",
      description: `Successfully toggled milestone status for ${selectedTasks.length} task(s)`,
      variant: "default"
    });
  };

  const handleDelete = () => {
    const selectedTasks = visibleTasks.filter(t => selectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast({
        title: "No Tasks Selected",
        description: "Please select tasks to delete",
        variant: "default"
      });
      return;
    }

    // Check for dependencies
    const hasDependencies = selectedTasks.some(task => 
      visibleTasks.some(t => 
        !selectedIds.has(t.id) && 
        t.predecessorIds?.split(',')
          .map(id => parseInt(id.trim()))
          .filter(id => !isNaN(id))
          .includes(task.siNo)
      )
    );

    if (hasDependencies) {
      setShowDeleteDialog(true);
    } else {
      // No dependencies, can delete directly
      const taskIds = selectedTasks.map(task => task.id);
      bulkDeleteTasks(taskIds);
      
      toast({
        title: "Tasks Deleted",
        description: `Successfully deleted ${taskIds.length} task(s)`,
        variant: "default"
      });
      
      clearSelection();
    }
  };

  const rowRenderer = ({ index, key, style }: any) => {
    const task = visibleTasks[index];
    if (!task) return null;
    
    return (
      <div 
        key={key} 
        style={{...style, height: '40px'}} // Fixed height to remove extra space
        className={`${activeTaskId === task.id ? 'bg-blue-50' : ''}`}
      >
        <TaskRow task={task} />
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-4 border-b flex items-center gap-4 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddTask}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
          <button
            onClick={() => {
              setSelecting(!isSelecting);
              if (!isSelecting) {
                // Clear active task when entering selection mode
                setActiveTask(null);
              } else {
                // Clear selection when exiting selection mode
                clearSelection();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              isSelecting ? 'bg-gray-200' : 'hover:bg-gray-100'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            {isSelecting ? 'Done' : 'Select'}
          </button>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        <div className="flex items-center gap-2">
          <button
            onClick={handlePromote}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              !isSelecting || selectedIds.size === 0 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'hover:bg-gray-100'
            }`}
            title="Promote Task"
            disabled={!isSelecting || selectedIds.size === 0}
          >
            <ChevronLeft className="w-4 h-4" />
            Promote
          </button>
          <button
            onClick={handleDemote}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              !isSelecting || selectedIds.size === 0 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'hover:bg-gray-100'
            }`}
            title="Demote Task"
            disabled={!isSelecting || selectedIds.size === 0}
          >
            <ChevronRight className="w-4 h-4" />
            Demote
          </button>
          <button
            onClick={handleToggleMilestone}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              !isSelecting || selectedIds.size === 0 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'hover:bg-gray-100'
            }`}
            title="Toggle Milestone"
            disabled={!isSelecting || selectedIds.size === 0}
          >
            <Diamond className="w-4 h-4" />
            Toggle Milestone
          </button>
          <button
            onClick={handleDelete}
            className={`flex items-center gap-2 px-4 py-2 rounded-md ${
              !isSelecting || selectedIds.size === 0 
                ? 'bg-red-300 text-white cursor-not-allowed' 
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
            disabled={!isSelecting || selectedIds.size === 0}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Single scrollable container for both header and body */}
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[1200px] h-full flex flex-col">
          {/* Table header */}
          <div className="border-b sticky top-0 bg-white z-10">
            <ResizableTable className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {isSelecting && (
                    <ResizableHeader width="60px" minWidth="60px" className="border border-gray-200 py-1 font-medium text-gray-700">
                      Select
                    </ResizableHeader>
                  )}
                  <ResizableHeader width="60px" minWidth="60px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    SI
                  </ResizableHeader>
                  <ResizableHeader width="80px" minWidth="80px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    WBS
                  </ResizableHeader>
                  <ResizableHeader width="250px" minWidth="150px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Task Name
                  </ResizableHeader>
                  <ResizableHeader width="100px" minWidth="80px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Predecessors
                  </ResizableHeader>
                  <ResizableHeader width="80px" minWidth="60px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Duration
                  </ResizableHeader>
                  <ResizableHeader width="100px" minWidth="90px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Start Date
                  </ResizableHeader>
                  <ResizableHeader width="100px" minWidth="90px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    End Date
                  </ResizableHeader>
                  <ResizableHeader width="100px" minWidth="90px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Actual Start
                  </ResizableHeader>
                  <ResizableHeader width="100px" minWidth="90px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Actual End
                  </ResizableHeader>
                  <ResizableHeader width="80px" minWidth="80px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Actual Duration
                  </ResizableHeader>
                  <ResizableHeader width="100px" minWidth="90px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Progress%
                  </ResizableHeader>
                  <ResizableHeader width="80px" minWidth="80px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    View
                  </ResizableHeader>
                  <ResizableHeader width="120px" minWidth="100px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Resource
                  </ResizableHeader>
                  <ResizableHeader width="80px" minWidth="80px" className="border border-gray-200 py-1 font-medium text-gray-700">
                    Status
                  </ResizableHeader>
                </tr>
              </thead>
            </ResizableTable>
          </div>

          {/* Table body */}
          <div className="flex-1">
            <AutoSizer>
              {({ width, height }) => (
                <List
                  width={width}
                  height={height}
                  rowCount={visibleTasks.length}
                  rowHeight={40}
                  rowRenderer={rowRenderer}
                  overscanRowCount={5}
                />
              )}
            </AutoSizer>
          </div>
        </div>
      </div>

      {showDeleteDialog && (
        <DeleteDialog 
          tasks={visibleTasks.filter(t => selectedIds.has(t.id))} 
          onClose={() => {
            setShowDeleteDialog(false);
            clearSelection();
          }} 
        />
      )}
    </div>
  );
}