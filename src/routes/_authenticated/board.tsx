import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LayoutGrid, LogOut, Plus, Search, Bot } from "lucide-react";
import { toast } from "sonner";
import type { UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { COLUMNS, positionAt, tasksQuery, type Task, type TaskStatus } from "@/lib/tasks";
import { Logo } from "@/components/board/Logo";
import { SortableTaskCard, TaskCardView } from "@/components/board/TaskCard";
import { TaskDialog, type TaskDraft } from "@/components/board/TaskDialog";
import { ChatPanel } from "@/components/board/ChatPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "My board — Flowboard" },
      { name: "description", content: "Your Kanban board with To Do and In Progress columns and an AI co-pilot." },
      { property: "og:title", content: "My board — Flowboard" },
      { property: "og:description", content: "Plan, track and chat with your AI co-pilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: serverTasks = [], isLoading } = useQuery(tasksQuery);
  const chatHistory = useQuery({
    queryKey: ["chat"],
    staleTime: Infinity,
    queryFn: async (): Promise<UIMessage[]> => {
      const { data, error } = await supabase.from("chat_messages").select("message_id,role,parts").order("created_at");
      if (error) throw error;
      return data.map((r) => ({ id: r.message_id, role: r.role as UIMessage["role"], parts: r.parts as UIMessage["parts"] }));
    },
  });

  const [local, setLocal] = useState<Task[] | null>(null);
  const tasks = local ?? serverTasks;
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; task: Task | null; status: TaskStatus }>({ open: false, task: null, status: "todo" });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter((t) => !q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }, [tasks, search]);
  const byCol = (s: TaskStatus) => filtered.filter((t) => t.status === s).sort((a, b) => a.position - b.position);

  const upsert = useMutation({
    mutationFn: async (args: { id?: string; patch: Partial<Task> }) => {
      if (args.id) {
        const { error } = await supabase.from("tasks").update({ ...args.patch, updated_at: new Date().toISOString() }).eq("id", args.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({ ...(args.patch as TaskDraft), user_id: user.id, position: args.patch.position ?? 0 });
        if (error) throw error;
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      setLocal(null);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const statusOf = (id: string): TaskStatus | undefined =>
    (COLUMNS.find((c) => c.id === id)?.id as TaskStatus | undefined) ?? tasks.find((t) => t.id === id)?.status;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setLocal(serverTasks);
  }
  function onDragOver(e: DragOverEvent) {
    if (!e.over) return;
    const to = statusOf(String(e.over.id));
    const id = String(e.active.id);
    setLocal((prev) => {
      const list = prev ?? serverTasks;
      const t = list.find((x) => x.id === id);
      if (!t || !to || t.status === to) return prev;
      return list.map((x) => (x.id === id ? { ...x, status: to } : x));
    });
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const list = local ?? serverTasks;
    const moved = list.find((t) => t.id === id);
    if (!e.over || !moved) return setLocal(null);
    const overId = String(e.over.id);
    const to = statusOf(overId) ?? moved.status;
    const column = list.filter((t) => t.status === to && t.id !== id).sort((a, b) => a.position - b.position);
    let index = column.findIndex((t) => t.id === overId);
    if (index === -1) index = column.length;
    const position = positionAt(column, index);
    setLocal(list.map((t) => (t.id === id ? { ...t, status: to, position } : t)));
    upsert.mutate({ id, patch: { status: to, position } });
  }

  function save(draft: TaskDraft) {
    const t = dialog.task;
    if (t) {
      const patch: Partial<Task> = { ...draft };
      if (draft.status !== t.status) patch.position = positionAt(byCol(draft.status), byCol(draft.status).length);
      upsert.mutate({ id: t.id, patch });
    } else {
      const col = tasks.filter((x) => x.status === draft.status).sort((a, b) => a.position - b.position);
      upsert.mutate({ patch: { ...draft, position: positionAt(col, col.length) } });
    }
    setDialog((d) => ({ ...d, open: false }));
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const total = tasks.length;
  const inProg = tasks.filter((t) => t.status === "in_progress").length;
  const avg = total ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total) : 0;
  const active = tasks.find((t) => t.id === activeId);

  return (
    <div className="min-h-screen p-3 md:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1500px] overflow-hidden rounded-[2rem] bg-frame shadow-frame">
        {/* Rail */}
        <aside className="hidden w-20 flex-col items-center gap-6 bg-rail py-7 md:flex">
          <Logo compact />
          <nav className="mt-6 flex flex-1 flex-col gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-rail-active text-primary-foreground">
              <LayoutGrid className="size-5" />
            </span>
          </nav>
          <button onClick={signOut} title="Sign out" className="flex size-11 items-center justify-center rounded-xl text-rail-foreground hover:bg-sidebar-accent">
            <LogOut className="size-5" />
          </button>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-6 py-7 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex w-full max-w-sm items-center gap-2 rounded-xl bg-card px-4 py-2.5 shadow-card">
              <Search className="size-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" className="w-full bg-transparent text-sm outline-none" />
            </label>
            <button
              onClick={() => setDialog({ open: true, task: null, status: "todo" })}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4" /> New task
            </button>
          </div>

          <h1 className="mt-10 text-4xl font-bold md:text-5xl">My Board</h1>
          <div className="mt-4 flex gap-6 border-b border-border text-sm">
            <span className="border-b-2 border-primary pb-3 font-semibold text-primary">Board</span>
            <span className="pb-3 text-muted-foreground">{user.email}</span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); setLocal(null); }}>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {COLUMNS.map((c) => (
                <Column key={c.id} id={c.id} title={c.title} tasks={byCol(c.id)} loading={isLoading}
                  onAdd={() => setDialog({ open: true, task: null, status: c.id })}
                  onOpen={(t) => setDialog({ open: true, task: t, status: t.status })} />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.2,0.8,0.2,1)" }}>
              {active ? <TaskCardView task={active} lifted /> : null}
            </DragOverlay>
          </DndContext>
        </main>

        {/* Right panel */}
        <aside className="hidden w-[380px] shrink-0 flex-col gap-5 border-l border-border bg-card/60 p-6 xl:flex">
          <div className="rounded-2xl bg-violet-soft p-5">
            <div className="flex items-center gap-5">
              <ProgressRing value={avg} />
              <div className="grid flex-1 grid-cols-2 gap-2">
                <Stat label="Total" value={total} />
                <Stat label="In progress" value={inProg} accent />
              </div>
            </div>
          </div>
          {chatHistory.data ? (
            <ChatPanel initialMessages={chatHistory.data} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Bot className="mr-2 size-4" /> Loading assistant…
            </div>
          )}
        </aside>
      </div>

      <TaskDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        task={dialog.task}
        defaultStatus={dialog.status}
        onSave={save}
        onDelete={dialog.task ? () => { remove.mutate(dialog.task!.id); setDialog((d) => ({ ...d, open: false })); } : undefined}
      />
    </div>
  );
}

function Column({ id, title, tasks, loading, onAdd, onOpen }: { id: TaskStatus; title: string; tasks: Task[]; loading: boolean; onAdd: () => void; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={cn("rounded-3xl bg-column p-4 transition-colors", isOver && "bg-accent")}>
      <div className="flex items-center justify-between px-2 pb-4 pt-1">
        <h2 className="text-xl font-semibold">
          {title} <span className="ml-1 text-muted-foreground">{tasks.length}</span>
        </h2>
        <button onClick={onAdd} className="flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-card hover:text-primary">
          <Plus className="size-4" />
        </button>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-40 flex-col gap-4">
          {tasks.map((t) => (
            <div key={t.id} className="animate-rise">
              <SortableTaskCard task={t} onOpen={() => onOpen(t)} />
            </div>
          ))}
          {!loading && tasks.length === 0 && (
            <button onClick={onAdd} className="flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary">
              Drop a card here or add one
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
        <span className={cn("h-5 w-1 rounded-full", accent ? "bg-primary" : "bg-violet")} />
        {value}
      </p>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="relative size-24">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-card" />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-violet transition-all duration-700"
          strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{value}%</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">avg</span>
      </div>
    </div>
  );
}
