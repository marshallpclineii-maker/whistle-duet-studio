import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Circle, Ear, Headphones, Radio, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Meter } from "@/components/console/Meter";
import { YouTubePanel, type NowPlaying } from "@/components/deck/YouTubePanel";
import { useRecorder, type CompletedTake } from "@/hooks/useRecorder";
import { findOrCreateTrack, uploadTake } from "@/lib/db";
import { formatTime } from "@/lib/audio/wav";
import { WHISTLE_MAX_HZ, WHISTLE_MIN_HZ } from "@/lib/audio/pitch";
import { cn } from "@/lib/utils";

interface Pending extends CompletedTake {
  nowPlaying: NowPlaying | null;
}

function PitchScope({ pitch, active }: { pitch: number; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const history = useRef<number[]>([]);

  useEffect(() => {
    history.current.push(pitch > 0 ? pitch : 0);
    if (history.current.length > 260) history.current.shift();
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (h / 4) * i);
      ctx.lineTo(w, (h / 4) * i);
      ctx.stroke();
    }

    const pts = history.current;
    const step = w / 260;
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? "#e8b45a" : "rgba(255,255,255,0.25)";
    ctx.beginPath();
    let drawing = false;
    pts.forEach((p, i) => {
      if (!p) {
        drawing = false;
        return;
      }
      const norm = (p - WHISTLE_MIN_HZ) / (WHISTLE_MAX_HZ - WHISTLE_MIN_HZ);
      const y = h - Math.min(1, Math.max(0, norm)) * (h - 8) - 4;
      const x = i * step;
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [pitch, active]);

  return <canvas ref={ref} className="h-32 w-full rounded-md bg-rail" />;
}

export function LiveDeck() {
  const qc = useQueryClient();
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const npRef = useRef<NowPlaying | null>(null);
  npRef.current = nowPlaying;

  const [autoDetect, setAutoDetect] = useState(true);
  const [sensitivity, setSensitivity] = useState(0.6);
  const [silenceMs, setSilenceMs] = useState(2000);
  const [pending, setPending] = useState<Pending | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");

  const save = useMutation({
    mutationFn: async (input: {
      take: CompletedTake;
      np: NowPlaying | null;
      title?: string;
      artist?: string;
    }) => {
      let trackId: string | null = null;
      let position: number | null = null;
      if (input.np) {
        const track = await findOrCreateTrack({
          title: input.np.title,
          artist: input.np.author,
          source: "youtube_music",
          external_id: input.np.videoId,
          url: `https://music.youtube.com/watch?v=${input.np.videoId}`,
          thumbnail_url: input.np.thumbnail,
        });
        trackId = track.id;
        position = Math.max(0, input.np.positionMs - input.take.durationMs);
      } else if (input.title?.trim()) {
        const track = await findOrCreateTrack({
          title: input.title.trim(),
          artist: input.artist?.trim() || null,
          source: "other",
        });
        trackId = track.id;
      }
      return uploadTake({
        blob: input.take.blob,
        durationMs: input.take.durationMs,
        trackId,
        trackPositionMs: position,
        autoDetected: input.take.autoDetected,
        peaks: input.take.peaks,
        pitchData: input.take.pitchData,
        title: input.np?.title ?? input.title?.trim() ?? "Untitled whistle",
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["takes"] });
      toast.success("Take saved to your library");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onTake = useCallback(
    (take: CompletedTake) => {
      const np = npRef.current;
      if (np) {
        save.mutate({ take, np });
      } else {
        setPending({ ...take, nowPlaying: null });
      }
    },
    [save],
  );

  const rec = useRecorder({ onTake, sensitivity, silenceMs, autoDetect });
  const recording = rec.status === "recording";

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <section className="panel brushed p-5">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-2.5 w-2.5 rounded-full",
              recording
                ? "animate-pulse bg-destructive"
                : rec.status === "listening"
                  ? "bg-meter-low"
                  : "bg-muted-foreground/40",
            )}
          />
          <h1 className="text-sm font-semibold uppercase tracking-[0.2em]">Live Deck</h1>
          <span className="readout ml-auto text-2xl tabular-nums text-primary">
            {formatTime(rec.elapsed)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto] gap-4">
          <div className="space-y-3">
            <PitchScope pitch={rec.pitch} active={recording} />
            <div className="flex items-center gap-4 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="readout text-base text-foreground">
                {rec.pitch > 0 ? `${Math.round(rec.pitch)} Hz` : "—"}
              </span>
              <span>
                whistle band {WHISTLE_MIN_HZ}–{WHISTLE_MAX_HZ} Hz
              </span>
            </div>
          </div>
          <div className="flex h-40 items-stretch gap-2">
            <Meter level={rec.level} />
            <Meter level={rec.level * 0.92} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant={recording ? "destructive" : "default"}
            onClick={() => void rec.toggleRecord()}
            className="min-w-40 gap-2 font-semibold uppercase tracking-widest"
          >
            {recording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4 fill-current" />}
            {recording ? "Stop" : "Record"}
          </Button>

          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => (rec.status === "idle" ? void rec.arm() : rec.disarm())}
          >
            <Ear className="h-4 w-4" />
            {rec.status === "idle" ? "Arm mic" : "Disarm"}
          </Button>

          <Button
            variant={rec.monitor ? "default" : "outline"}
            className="gap-2"
            onClick={() => rec.setMonitor(!rec.monitor)}
          >
            <Headphones className="h-4 w-4" />
            Monitor
          </Button>
        </div>

        {rec.error ? (
          <p className="mt-3 text-xs text-destructive">{rec.error}</p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Keep your song playing on your phone or in the in-app player — the deck listens to
            the room, so your whistle and the track land on the same take.
          </p>
        )}

        <div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider">Always listening</Label>
              <p className="text-[11px] text-muted-foreground">Auto-record when you whistle</p>
            </div>
            <Switch checked={autoDetect} onCheckedChange={setAutoDetect} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider">Input gain</Label>
              <p className="text-[11px] text-muted-foreground">{rec.gain.toFixed(1)}x</p>
            </div>
            <Slider
              className="w-32"
              min={0.5}
              max={4}
              step={0.1}
              value={[rec.gain]}
              onValueChange={([v]) => rec.setGain(v ?? 1)}
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider">Trigger sensitivity</Label>
            <Slider
              className="mt-3"
              min={0.1}
              max={1}
              step={0.05}
              value={[sensitivity]}
              onValueChange={([v]) => setSensitivity(v ?? 0.6)}
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider">
              Auto-stop after {(silenceMs / 1000).toFixed(1)}s silence
            </Label>
            <Slider
              className="mt-3"
              min={500}
              max={6000}
              step={250}
              value={[silenceMs]}
              onValueChange={([v]) => setSilenceMs(v ?? 2000)}
            />
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <YouTubePanel onNowPlaying={setNowPlaying} />

        <div className="panel p-4">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest">Now tagging</h2>
          </div>
          {nowPlaying ? (
            <div className="mt-3 flex gap-3">
              <img
                src={nowPlaying.thumbnail}
                alt=""
                className="h-14 w-24 rounded-sm object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{nowPlaying.title}</p>
                <p className="truncate text-xs text-muted-foreground">{nowPlaying.author}</p>
                <p className="readout text-[11px] text-primary">
                  @ {formatTime(nowPlaying.positionMs)}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Nothing playing in-app. Takes will prompt you for the song so you can tag what's
              running on YouTube Music, Pandora or anywhere else.
            </p>
          )}
        </div>
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag this take</DialogTitle>
            <DialogDescription>
              What were you whistling along to? Leave blank to save it untagged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="song">Song</Label>
              <Input
                id="song"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Song title"
              />
            </div>
            <div>
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
                placeholder="Artist"
              />
            </div>
            <p className="readout text-xs text-muted-foreground">
              {pending ? formatTime(pending.durationMs) : ""} captured
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (pending) save.mutate({ take: pending, np: null });
                setPending(null);
              }}
            >
              Save untagged
            </Button>
            <Button
              onClick={() => {
                if (pending)
                  save.mutate({
                    take: pending,
                    np: null,
                    title: manualTitle,
                    artist: manualArtist,
                  });
                setPending(null);
                setManualTitle("");
                setManualArtist("");
              }}
            >
              Save take
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
