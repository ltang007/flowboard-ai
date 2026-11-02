import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, GripVertical, Database } from "lucide-react";
import { Logo } from "@/components/board/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flowboard — Kanban with an AI co-pilot" },
      { name: "description", content: "Plan your work on a gorgeous Kanban board and let an AI assistant create, move and explain your tasks." },
      { property: "og:title", content: "Flowboard — Kanban with an AI co-pilot" },
      { property: "og:description", content: "A gorgeous Kanban board with an AI assistant. Your tasks are saved so you can pick up anytime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const features = [
    { icon: GripVertical, title: "Drag & drop", text: "Move cards between To Do and In Progress in a flick." },
    { icon: Bot, title: "AI co-pilot", text: "Ask questions, get advice, or have it create and move cards." },
    { icon: Database, title: "Always saved", text: "Everything lives in your account — come back anytime." },
  ];
  return (
    <div className="min-h-screen p-4 md:p-10">
      <div className="mx-auto max-w-6xl rounded-[2rem] bg-frame p-8 shadow-frame md:p-14">
        <header className="flex items-center justify-between">
          <Logo />
          <Link to="/auth" className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            Sign in
          </Link>
        </header>
        <section className="mt-20 max-w-3xl animate-rise">
          <span className="rounded-full bg-tag-orange px-3 py-1 text-xs font-semibold uppercase tracking-wider text-tag-orange-fg">
            Kanban, reimagined
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.05] md:text-7xl">
            Your work, in flow.
            <span className="block text-violet">With a co-pilot.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A calm, beautiful board for what's next and what's happening — plus an assistant that knows your tasks.
          </p>
          <Link
            to="/auth"
            className="mt-10 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-4 font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5"
          >
            Get started free <ArrowRight className="size-4" />
          </Link>
        </section>
        <section className="mt-20 grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl bg-card p-6 shadow-card">
              <div className="flex size-11 items-center justify-center rounded-xl bg-violet-soft text-violet">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
