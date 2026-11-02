import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "todo" | "in_progress";
export type Task = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: TaskStatus;
  position: number;
  progress: number;
  due_date: string | null;
  created_at: string;
};

export const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
];

export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: async (): Promise<Task[]> => {
    const { data, error } = await supabase.from("tasks").select("*").order("position");
    if (error) throw error;
    return data as Task[];
  },
});

const TAG_STYLES = [
  "bg-tag-orange text-tag-orange-fg",
  "bg-tag-green text-tag-green-fg",
  "bg-tag-purple text-tag-purple-fg",
  "bg-tag-blue text-tag-blue-fg",
  "bg-tag-pink text-tag-pink-fg",
];
export function tagStyle(category: string) {
  let h = 0;
  for (const c of category.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAG_STYLES[h % TAG_STYLES.length];
}

/** Position for an item placed at `index` in a list (excluding the moved item). */
export function positionAt(list: Task[], index: number) {
  const before = list[index - 1]?.position;
  const after = list[index]?.position;
  if (before === undefined && after === undefined) return 1000;
  if (before === undefined) return after! - 1000;
  if (after === undefined) return before + 1000;
  return (before + after) / 2;
}
