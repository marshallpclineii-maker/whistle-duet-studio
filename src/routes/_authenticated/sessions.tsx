import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Music4, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSession, listSessions, type SessionRow } from "@/lib/sessions";

export const Route = createFileRoute("/_authenticated/sessions")({
  head: () => ({
    meta: [
      { title: "Synced Sessions — WhistleDeck" },
      {
        name: "description",
        content: "Every YouTube-synced whistle session you've recorded, saved to your account.",
      },
      { property: "og:title", content: "Synced Sessions — WhistleDeck" },
      {
        property: "og:description",
        content: "Reopen, remix or delete your saved YouTube-synced whistle sessions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionsPage,
});

function SessionsPage() {
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

  return (
    <main className="mx-auto max-w-4xl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.2em]">Synced sessions</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Whistle sessions locked to a YouTube backing track.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/sync">
            <Plus className="mr-1 h-4 w-4" /> New session
          </Link>
        </Button>
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
