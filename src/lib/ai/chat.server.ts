import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";

const MODEL = "openai/gpt-6-astra";

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        h.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function handleChat(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in.");
  const supabase = userClient(token);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return json(401, "Please sign in.");
  const userId = userData.user.id;

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI is not configured.");

  const body = (await request.json()) as { messages?: UIMessage[] };
  const messages = body.messages ?? [];
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return json(400, "No message to send.");

  const { error: saveErr } = await supabase
    .from("chat_messages")
    .upsert(
      { user_id: userId, message_id: last.id, role: "user", parts: last.parts as never },
      { onConflict: "user_id,message_id" },
    );
  if (saveErr) console.error("save user message failed", saveErr);

  const tools = {
    list_tasks: tool({
      description: "List all of the user's tasks on the Kanban board.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from("tasks")
          .select("id,title,description,category,status,progress,due_date")
          .order("position");
        if (error) return { error: error.message };
        return { tasks: data };
      },
    }),
    create_task: tool({
      description: "Create a new task card on the board.",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().nullable(),
        category: z.string().nullable().describe("Short tag like Design, Research, Development"),
        status: z.enum(["todo", "in_progress"]).nullable(),
        due_date: z.string().nullable().describe("YYYY-MM-DD"),
      }),
      execute: async (input) => {
        const status = input.status ?? "todo";
        const { data: maxRow } = await supabase
          .from("tasks")
          .select("position")
          .eq("status", status)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: userId,
            title: input.title,
            description: input.description ?? "",
            category: input.category ?? "General",
            status,
            due_date: input.due_date || null,
            position: (maxRow?.position ?? 0) + 1000,
          })
          .select("id,title,status")
          .single();
        if (error) return { error: error.message };
        return { created: data };
      },
    }),
    move_task: tool({
      description: "Move a task to another column (todo or in_progress). Call list_tasks first to find the id.",
      inputSchema: z.object({ id: z.string(), status: z.enum(["todo", "in_progress"]) }),
      execute: async ({ id, status }) => {
        const { data: maxRow } = await supabase
          .from("tasks")
          .select("position")
          .eq("status", status)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data, error } = await supabase
          .from("tasks")
          .update({ status, position: (maxRow?.position ?? 0) + 1000, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id,title,status")
          .single();
        if (error) return { error: error.message };
        return { moved: data };
      },
    }),
  };

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const today = new Date().toISOString().slice(0, 10);
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: `You are Flo, a friendly, concise productivity co-pilot inside a Kanban app with two columns: "To Do" (todo) and "In Progress" (in_progress). Today is ${today}.
- Answer questions about the user's tasks by calling list_tasks.
- When asked, create tasks with create_task or move them with move_task (look up ids via list_tasks first).
- Give practical productivity advice when asked. Keep replies short and use markdown lists where helpful.`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(50),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    generateMessageId: () => crypto.randomUUID(),
    onError: (err) => {
      const e = err as { statusCode?: number; message?: string };
      if (e?.statusCode === 429) return "Too many requests right now — please try again in a moment.";
      if (e?.statusCode === 402) return "AI credits have run out. Add credits in your workspace to keep chatting.";
      return e?.message ?? "Something went wrong.";
    },
    onFinish: async ({ responseMessage }) => {
      const { error } = await supabase.from("chat_messages").upsert(
        {
          user_id: userId,
          message_id: responseMessage.id,
          role: "assistant",
          parts: responseMessage.parts as never,
        },
        { onConflict: "user_id,message_id" },
      );
      if (error) console.error("save assistant message failed", error);
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
