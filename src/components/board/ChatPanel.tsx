import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";

const SUGGESTIONS = ["What's in progress?", "Add a task to review the roadmap", "How should I prioritise today?"];
const TOOL_TITLES: Record<string, string> = {
  "tool-list_tasks": "Checked your board",
  "tool-create_task": "Created a task",
  "tool-move_task": "Moved a task",
};

export function ChatPanel({ initialMessages }: { initialMessages: UIMessage[] }) {
  const qc = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [],
  );
  const { messages, sendMessage, status, stop } = useChat({
    id: "main",
    messages: initialMessages,
    transport,
    onFinish: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err) => toast.error(err.message || "The assistant couldn't reply."),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-1 pb-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-violet text-primary-foreground">
          <Bot className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Flo · AI co-pilot</h3>
          <p className="text-xs text-muted-foreground">Ask, plan, or let me move cards</p>
        </div>
      </div>
      <Conversation className="min-h-0 flex-1 rounded-2xl bg-column">
        <ConversationContent className="gap-5 p-4">
          {messages.length === 0 && (
            <div className="space-y-2 pt-6 text-center">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-xl bg-card px-3 py-2 text-left text-xs font-medium shadow-card hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className="group-[.is-user]:bg-foreground group-[.is-user]:text-background">
                {m.parts.map((p, i) => {
                  if (p.type === "text") return <MessageResponse key={i}>{p.text}</MessageResponse>;
                  if (p.type.startsWith("tool-")) {
                    const tp = p as Extract<UIMessage["parts"][number], { type: `tool-${string}`; state: string }>;
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={tp.type as never} state={tp.state as never} title={TOOL_TITLES[tp.type] ?? tp.type} />
                        <ToolContent>
                          <ToolInput input={(tp as { input?: unknown }).input} />
                          <ToolOutput output={(tp as { output?: unknown }).output} errorText={(tp as { errorText?: string }).errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer className="text-sm">Thinking…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput className="mt-3 rounded-2xl bg-card" onSubmit={(msg) => send(msg.text ?? "")}>
        <PromptInputTextarea ref={textareaRef} placeholder="Ask Flo anything…" />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
