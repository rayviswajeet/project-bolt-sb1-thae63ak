import TaskTable from '@/components/TaskTable';
import GanttChart from '@/components/GanttChart';
import { prisma } from '@/lib/prisma';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import HolidayButton from '@/components/HolidayButton';

export default async function Home() {
  const tasks = await prisma.task.findMany({
    orderBy: { siNo: 'asc' }
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="h-screen max-w-[100%] mx-auto py-6">
        <div className="flex items-center justify-between pl-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Project Planning Screen</h1>
          <HolidayButton />
        </div>
        
        <ResizablePanelGroup
          direction="horizontal"
          className="rounded-lg border bg-white"
        >
          <ResizablePanel defaultSize={100} minSize={10} maxSize={100}>
            <div className="h-full overflow-x-auto">
              <TaskTable initialTasks={tasks} />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={0} minSize={0} maxSize={90}>
            <div className="h-full p-4">
              <GanttChart tasks={tasks} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  );
}