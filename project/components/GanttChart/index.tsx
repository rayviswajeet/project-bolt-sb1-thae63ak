'use client';

import { useEffect, useRef } from 'react';
import { Task } from '@/types/task';
import { useTaskStore } from '@/store/taskStore';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

declare const gantt: any;

interface GanttChartProps {
  tasks: Task[];
}

export default function GanttChart({ tasks: initialTasks }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { tasks } = useTaskStore();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      require('dhtmlx-gantt');

      // Configure Gantt
      gantt.config.date_format = '%Y-%m-%d %H:%i';
      gantt.config.work_time = true;
      gantt.config.skip_off_time = true;
      gantt.config.auto_scheduling = false; // Disable auto scheduling
      gantt.config.auto_scheduling_strict = false;
      gantt.config.row_height = 24; // Reduce row height to match task table
      gantt.config.min_column_width = 40;
      gantt.config.scale_height = 50; // Reduce scale height

      // Hide the grid/tree panel
      gantt.config.show_grid = false;

      // Disable editing
      gantt.config.readonly = true;
      gantt.config.drag_move = false;
      gantt.config.drag_resize = false;
      gantt.config.drag_links = false;
      gantt.config.drag_progress = false;

      // Configure scales
      gantt.config.scales = [
        { unit: 'month', step: 1, format: '%F, %Y' },
        { unit: 'day', step: 1, format: '%d %M' }
      ];

      // Custom task styling
      gantt.templates.task_class = (start: Date, end: Date, task: any) => {
        if (task.isFinancialMilestone) return 'milestone-task';
        if (task.goLive) return 'golive-task';
        if (task.level === 0) return 'level0-task';
        if (task.actualEndDate) {
          return task.actualEndDate > task.endDate ? 'delayed-task' : 'completed-task';
        }
        if (task.actualStartDate) return 'in-progress-task';
        return '';
      };

      // Custom task text rendering
      gantt.templates.task_text = (start: Date, end: Date, task: any) => {
        return task.text;
      };

      // Custom task rendering to handle actual dates
      gantt.templates.task_start_date = (date: Date, task: any) => {
        return task.actual_start ? task.actual_start : task.start_date;
      };

      gantt.templates.task_end_date = (date: Date, task: any) => {
        return task.actual_end ? task.actual_end : task.end_date;
      };

      // Initialize Gantt
      gantt.init(containerRef.current);

      // Load data
      const ganttTasks = tasks.filter(task => !task.isDeleted).map(task => {
        const today = new Date();
        
        // Determine progress based on actual dates
        let progress = 0;
        if (task.actualEndDate) {
          progress = 1; // 100% if completed
        } else if (task.actualStartDate) {
          progress = 0.5; // 50% if in progress
        }

        return {
          id: task.id,
          text: task.taskName || `<task${task.siNo}>`,
          start_date: task.startDate || new Date(),
          end_date: task.endDate || new Date(),
          actual_start: task.actualStartDate,
          actual_end: task.actualEndDate,
          progress: progress,
          parent: null,
          type: task.isFinancialMilestone ? 'milestone' : 'task',
          isFinancialMilestone: task.isFinancialMilestone,
          goLive: task.goLive,
          level: task.level,
          open: true
        };
      });

      // Create links with special handling for level 0 tasks
      const links = tasks
        .filter(task => !task.isDeleted && task.predecessorIds)
        .flatMap(task => 
          task.predecessorIds!.split(',').map(siNo => {
            const predecessor = tasks.find(t => !t.isDeleted && t.siNo === Number(siNo));
            if (!predecessor) return null;
            
            return {
              id: `${predecessor.id}-${task.id}`,
              source: predecessor.id,
              target: task.id,
              type: '0' // Finish-to-Start
            };
          })
        )
        .filter(Boolean);

      gantt.parse({ data: ganttTasks, links });

      // Handle resize events to redraw the gantt chart
      const resizeObserver = new ResizeObserver(() => {
        gantt.render();
      });
      
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        if (typeof window !== 'undefined') {
          gantt.clearAll();
          resizeObserver.disconnect();
        }
      };
    }
  }, [tasks]);

  return (
    <div className="h-full flex flex-col">
      <style jsx global>{`
        .gantt_task_line.milestone-task {
          background-color: #3b82f6;
          border-color: #2563eb;
          border-radius: 50%;
          width: 12px !important;
          height: 12px !important;
          transform: rotate(45deg);
          margin-left: -6px;
          margin-top: 6px;
        }
        .gantt_task_line.golive-task {
          background-color: #eab308;
          border-color: #ca8a04;
          background-image: linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent);
          background-size: 10px 10px;
        }
        .gantt_task_line.level0-task {
          background-color: #f97316;
          border-color: #ea580c;
        }
        .gantt_task_line.completed-task {
          background-color: #22c55e;
          border-color: #16a34a;
        }
        .gantt_task_line.in-progress-task {
          background-color: #eab308;
          border-color: #ca8a04;
        }
        .gantt_task_line.delayed-task {
          background-color: #ef4444;
          border-color: #dc2626;
        }
        .gantt_task_line {
          border-radius: 2px;
          height: 12px !important;
          margin-top: 6px;
        }
        .gantt_task_content {
          line-height: 12px;
          color: #fff;
          font-size: 10px;
        }
        .gantt_task_link {
          border-color: #9ca3af;
        }
        .gantt_task_link:hover {
          border-color: #6b7280;
        }
        .gantt_link_arrow {
          border-color: #9ca3af;
        }
        .gantt_task_progress {
          background-color: rgba(0, 0, 0, 0.2);
        }
        .gantt_container {
          min-width: 100px !important;
          width: 100% !important;
        }
        .gantt_grid_scale, .gantt_task_scale {
          color: #64748b;
          font-size: 11px;
          border-bottom: 1px solid #e2e8f0;
        }
        .gantt_scale_cell {
          padding-top: 2px;
          padding-bottom: 2px;
        }
        .gantt_row {
          height: 24px !important; /* Match task table row height */
          border-bottom: 1px solid #e2e8f0;
        }
        .gantt_task_row {
          height: 24px !important; /* Match task table row height */
          border-bottom: 1px solid #e2e8f0;
        }
        .gantt_task {
          padding-top: 0 !important;
        }
        .gantt_grid_head_cell {
          font-weight: 500;
          color: #64748b;
          font-size: 11px;
        }
        .gantt_grid_data {
          font-size: 11px;
        }
      `}</style>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}