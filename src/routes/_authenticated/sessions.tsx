import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Music4, Plus, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteSession, listSessions, type SessionRow } from "@/lib/sessions";

export const Route = createFileRoute("/_authenticated/sessions")({
  head: () => ({
    meta: [
      { title: "Your Sessions — Whistle" },
      {
        name: "description",
        content: "Every Whistle session you've recorded, saved securely in the cloud.",
      },
      { property: "og:title", content: "Your Whistle Sessions" },
      { property: "og:description", content: "Reopen, remix or delete your saved studio sessions." },
    ],
  }),
  component: SessionsPage,
});

function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    listSessions()
      .then(setSessions)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Could not load sessions"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link to="/" className="font-display text-base font-semibold">
            Whistle <span className="text-primary">⚡</span>
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Your sessions</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to="/sync">
              <Plus className="mr-1 h-4 w-4" /> New session
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : sessions.length === 0 ? (
        <div className="panel p-10 text-center">
          <Music4 className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            No sessions yet. Open the studio and record your first take.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id} className="panel flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link
                  to="/sync"
                  search={{ session: session.id }}
                  className="font-medium hover:text-primary"
                >
                  {session.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {session.duration_seconds}s · updated{" "}
                  {new Date(session.updated_at).toLocaleDateString()}
                  {session.uploaded_video_id ? " · published" : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${session.title}`}
                onClick={() => {
                  void deleteSession(session.id)
                    .then(() => {
                      setSessions((current) => current.filter((s) => s.id !== session.id));
                    })
                    .catch(() => toast.error("Could not delete that session"));
                }}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
