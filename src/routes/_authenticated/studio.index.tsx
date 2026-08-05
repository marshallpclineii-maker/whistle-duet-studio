import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProject, deleteProject, listProjects } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/studio/")({
  head: () => ({
    meta: [
      { title: "Studio Sessions — WhistleDeck" },
      {
        name: "description",
        content:
          "Multitrack whistle sessions with overdubbing, splicing, effects racks and mixdown export.",
      },
      { property: "og:title", content: "Studio Sessions — WhistleDeck" },
      {
        property: "og:description",
        content: "Overdub, splice and remix your whistle takes into full multitrack sessions.",
      },
    ],
  }),
  component: StudioList,
});

function StudioList() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const create = useMutation({
    mutationFn: () => createProject(name.trim() || "New session"),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-sm font-semibold uppercase tracking-[0.2em]">Studio</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Multitrack sessions for overdubbing, splicing and reshaping your whistles.
        </p>
      </header>

      <div className="panel brushed flex gap-2 p-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create.mutate()}
          placeholder="Session name"
          className="bg-rail"
        />
        <Button onClick={() => create.mutate()} className="gap-2">
          <Plus className="h-4 w-4" /> New session
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className="panel flex items-center gap-3 p-4">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <Link
              to="/studio/$projectId"
              params={{ projectId: p.id }}
              className="min-w-0 flex-1"
            >
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {new Date(p.updated_at).toLocaleDateString()}
              </span>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Delete session"
              onClick={() => remove.mutate(p.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
