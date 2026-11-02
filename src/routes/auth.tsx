import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/board/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Flowboard" },
      { name: "description", content: "Sign in to your Flowboard Kanban board." },
      { property: "og:title", content: "Sign in — Flowboard" },
      { property: "og:description", content: "Access your saved Kanban board and AI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/board", replace: true });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/board` },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/board" });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/board" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-frame p-10 shadow-frame animate-rise">
        <Logo />
        {sent ? (
          <div className="mt-10">
            <h1 className="text-3xl font-bold">Check your email</h1>
            <p className="mt-3 text-muted-foreground">
              We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Click it to open your board.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-10 text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create your board"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to pick up where you left off." : "Your tasks will be saved to your account."}
            </p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-glow transition-opacity disabled:opacity-60"
              >
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-6 text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
