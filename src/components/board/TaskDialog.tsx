import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import type { Task, TaskStatus } from "@/lib/tasks";

export type TaskDraft = Pick<Task, "title" | "description" | "category" | "status" | "progress" | "due_date">;

const field = "w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultStatus,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  defaultStatus: TaskStatus;
  onSave: (draft: TaskDraft) => void;
  onDelete?: () => void;
}) {
  const empty: TaskDraft = { title: "", description: "", category: "Design", status: defaultStatus, progress: 0, due_date: null };
  const [d, setD] = useState<TaskDraft>(empty);
  useEffect(() => {
    if (open) setD(task ? { ...task } : { ...empty, status: defaultStatus });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task, defaultStatus]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.title.trim()) return;
    onSave({ ...d, title: d.title.trim(), category: d.category.trim() || "General" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <input autoFocus className={field} placeholder="Task title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <textarea className={field} rows={3} placeholder="Description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={field} placeholder="Category" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} />
            <input type="date" className={field} value={d.due_date ?? ""} onChange={(e) => setD({ ...d, due_date: e.target.value || null })} />
          </div>
          <select className={field} value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as TaskStatus })}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
          </select>
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{d.progress}%</span>
            </div>
            <Slider value={[d.progress]} max={100} step={5} onValueChange={([v]) => setD({ ...d, progress: v })} />
          </div>
          <div className="flex items-center justify-between pt-2">
            {onDelete ? (
              <button type="button" onClick={onDelete} className="text-sm font-medium text-destructive hover:underline">
                Delete task
              </button>
            ) : <span />}
            <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
              {task ? "Save changes" : "Add task"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
