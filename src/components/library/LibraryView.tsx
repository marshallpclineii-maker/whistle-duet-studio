import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Trash2, Music4, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Waveform } from "@/components/console/Meter";
import { deleteTake, listTakes, renameTake, takeUrl, type TakeWithTrack } from "@/lib/db";
import { formatTime } from "@/lib/audio/wav";

function TakeRow({ take }: { take: TakeWithTrack }) {
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState(take.title);

  const peaks = Array.isArray(take.peaks) ? (take.peaks as number[]) : [];

  const toggle = async () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!audioRef.current) {
      const url = await takeUrl(take.storage_path);
      const el = new Audio(url);
      el.ontimeupdate = () => setProgress(el.currentTime / (el.duration || 1));
      el.onended = () => {
        setPlaying(false);
        setProgress(0);
      };
      audioRef.current = el;
    }
    await audioRef.current.play();
    setPlaying(true);
  };

  const remove = useMutation({
    mutationFn: () => deleteTake(take),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["takes"] });
      toast.success("Take deleted");
    },
  });

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-panel-raised px-3 py-2">
      <Button size="icon" variant="secondary" onClick={() => void toggle()} aria-label="Play take">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <div className="min-w-0 flex-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== take.title) void renameTake(take.id, title);
          }}
          className="h-7 border-transparent bg-transparent px-1 text-sm focus-visible:border-border"
        />
        <Waveform peaks={peaks} progress={progress} height={34} />
      </div>

      <div className="w-24 shrink-0 text-right">
        <p className="readout text-xs text-primary">{formatTime(take.duration_ms)}</p>
        {take.auto_detected ? (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Mic className="h-3 w-3" /> auto
          </span>
        ) : null}
      </div>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => remove.mutate()}
        aria-label="Delete take"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function LibraryView() {
  const { data: takes = [], isLoading } = useQuery({ queryKey: ["takes"], queryFn: listTakes });

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; artist: string; thumb: string | null; takes: TakeWithTrack[] }>();
    for (const t of takes) {
      const key = t.track_id ?? "untagged";
      if (!map.has(key)) {
        map.set(key, {
          title: t.tracks?.title ?? "Untagged whistles",
          artist: t.tracks?.artist ?? "No song attached",
          thumb: t.tracks?.thumbnail_url ?? null,
          takes: [],
        });
      }
      map.get(key)!.takes.push(t);
    }
    return [...map.values()];
  }, [takes]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-sm font-semibold uppercase tracking-[0.2em]">Library</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every take, grouped by the song you were whistling along to.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading takes…</p>
      ) : groups.length === 0 ? (
        <div className="panel p-10 text-center">
          <Music4 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No takes yet. Head to the Live Deck and whistle something.
          </p>
        </div>
      ) : (
        groups.map((g, i) => (
          <section key={i} className="panel p-4">
            <div className="mb-3 flex items-center gap-3">
              {g.thumb ? (
                <img src={g.thumb} alt="" className="h-10 w-16 rounded-sm object-cover" />
              ) : (
                <span className="flex h-10 w-16 items-center justify-center rounded-sm bg-rail">
                  <Music4 className="h-4 w-4 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{g.title}</h2>
                <p className="truncate text-xs text-muted-foreground">{g.artist}</p>
              </div>
              <span className="readout ml-auto text-xs text-muted-foreground">
                {g.takes.length} take{g.takes.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-2">
              {g.takes.map((t) => (
                <TakeRow key={t.id} take={t} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
