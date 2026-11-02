import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { tagStyle, type Task } from "@/lib/tasks";

export function TaskCardView({ task, lifted, onOpen }: { task: Task; lifted?: boolean; onOpen?: () => void }) {
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group cursor-grab rounded-2xl bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 active:cursor-grabbing",
        lifted && "card-lifted",
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider", tagStyle(task.category))}>
          {task.category}
        </span>
        <MoreHorizontal className="size-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
      </div>
      <h3 className="mt-3 font-sans text-[15px] font-semibold leading-snug">{task.title}</h3>
      {task.description && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{task.description}</p>}
      <div className="mt-4">
        <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>Progress</span>
          <span className="text-foreground">{task.progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-soft">
          <div className="h-full rounded-full bg-violet transition-all" style={{ width: `${task.progress}%` }} />
        </div>
      </div>
      {task.due_date && (
        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {format(new Date(task.due_date + "T00:00:00"), "d MMM")}
        </div>
      )}
    </div>
  );
}

export function SortableTaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "rounded-2xl border-2 border-dashed border-border opacity-40 [&>*]:invisible")}
    >
      <TaskCardView task={task} onOpen={onOpen} />
    </div>
  );
}
