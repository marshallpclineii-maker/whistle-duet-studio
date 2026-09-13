import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Circle,
  Download,
  Layers,
  Loader2,
  Pause,
  Play,
  Save,
  Scissors,
  Square,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/components/studio/use-studio";
import { Timeline } from "@/components/studio/Timeline";
import { Mixer } from "@/components/studio/Mixer";
import { UploadDialog } from "@/components/studio/UploadDialog";
import {
  YouTubePlayer,
  parseVideoId,
  type YouTubeController,
} from "@/components/studio/YouTubePlayer";
import {
  createSession,
  getSession,
  updateSession,
  uploadAudio,
  downloadAudio,
} from "@/lib/sessions";
import { decodeBlob } from "@/lib/audio/engine";
import type { Arrangement, Track } from "@/lib/audio/types";

type StudioSearch = { session?: string | undefined };

export const Route = createFileRoute("/_authenticated/sync")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    session: typeof search["session"] === "string" ? search["session"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Studio — Whistle Multi-Track Recorder" },
      {
        name: "description",
        content:
          "Record, overdub, splice and mix live takes over a YouTube backing track, then publish the mixdown to your channel.",
      },
      { property: "og:title", content: "Whistle Studio" },
      {
        property: "og:description",
        content: "Multi-track browser recording with overdubs, splicing and YouTube publishing.",
      },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const ytRef = useRef<YouTubeController>(null);

  const [title, setTitle] = useState("Untitled session");
  const [videoInput, setVideoInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(search.session ?? null);
  const [pxPerSecond, setPxPerSecond] = useState(60);
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(search.session));

  const studio = useStudio({
    onPlay: (time) => {
      ytRef.current?.seek(time);
      ytRef.current?.play();
    },
    onPause: () => ytRef.current?.pause(),
    onSeek: (time) => ytRef.current?.seek(time),
    onRecordStart: () => ytRef.current?.play(),
    onRecordStop: () => ytRef.current?.pause(),
  });

  const { loadArrangement, registerBuffer } = studio;

  // Load an existing session
  useEffect(() => {
    const id = search.session;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const row = await getSession(id);
        if (!row || cancelled) return;
        setSessionId(row.id);
        setTitle(row.title);
        setVideoId(row.youtube_video_id);
        setVideoInput(row.youtube_video_id ?? "");
        const arrangement = row.arrangement as Arrangement | null;
        if (arrangement?.buffers?.length) {
          for (const ref of arrangement.buffers) {
            if (!ref.path) continue;
            const blob = await downloadAudio(ref.path);
            const buffer = await decodeBlob(blob);
            if (cancelled) return;
            registerBuffer(ref.id, buffer);
          }
        }
        if (arrangement?.tracks) loadArrangement(arrangement.tracks);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load that session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.session, loadArrangement, registerBuffer]);

  const bufferPaths = useRef<Map<string, string>>(new Map());

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Please sign in again");
    const row = await createSession(data.user.id, title);
    setSessionId(row.id);
    void navigate({ to: "/studio", search: { session: row.id }, replace: true });
    return row.id;
  }, [navigate, sessionId, title]);

  const loadVideo = () => {
    const id = parseVideoId(videoInput);
    if (!id) {
      toast.error("Paste a YouTube link or video ID");
      return;
    }
    setVideoId(id);
  };

  const toggleRecord = async () => {
    try {
      if (studio.isRecording) {
        const result = await studio.stopRecording();
        if (result && sessionId) {
          const path = `${sessionId}/${result.bufferId}.wav`;
          void uploadAudio(path, result.blob)
            .then(() => bufferPaths.current.set(result.bufferId, path))
            .catch(() => undefined);
        } else if (result) {
          bufferPaths.current.set(result.bufferId, "");
        }
      } else {
        await studio.startRecording();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Microphone access is required to record",
      );
    }
  };

  const saveSession = async () => {
    setSaving(true);
    try {
      const id = await ensureSession();
      const bufferIds = new Set<string>();
      studio.tracks.forEach((track: Track) =>
        track.clips.forEach((clip) => bufferIds.add(clip.bufferId)),
      );

      const buffers = [] as Arrangement["buffers"];
      for (const bufferId of bufferIds) {
        let path = bufferPaths.current.get(bufferId) || "";
        const buffer = studio.getBuffer(bufferId);
        if (!path && buffer) {
          const { audioBufferToWav } = await import("@/lib/audio/engine");
          path = `${id}/${bufferId}.wav`;
          await uploadAudio(path, audioBufferToWav(buffer));
          bufferPaths.current.set(bufferId, path);
        }
        buffers.push({ id: bufferId, path: path || null, duration: buffer?.duration ?? 0 });
      }

      await updateSession(id, {
        title,
        youtube_video_id: videoId,
        arrangement: { tracks: studio.tracks, buffers } satisfies Arrangement,
        duration_seconds: Math.round(studio.duration),
      });
      toast.success("Session saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the session");
    } finally {
      setSaving(false);
    }
  };

  const exportMix = async () => {
    try {
      const { blob } = await studio.mixdown();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.replace(/[^\w-]+/g, "_") || "whistle-mix"}.wav`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mixdown failed");
    }
  };

  const buildMedia = async () => (await studio.mixdown()).blob;

  const selected = useMemo(() => {
    for (const track of studio.tracks) {
      const clip = track.clips.find((c) => c.id === studio.selectedClip);
      if (clip) return { track, clip };
    }
    return null;
  }, [studio.tracks, studio.selectedClip]);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Link to="/" className="font-display text-base font-semibold">
          Whistle <span className="text-primary">⚡</span>
        </Link>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-8 w-56 bg-transparent"
          aria-label="Session title"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/sessions">Sessions</Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void saveSession()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportMix()}>
            <Download className="mr-1 h-4 w-4" /> Export WAV
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Publish
          </Button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <section className="panel p-3">
            <h2 className="mb-2 text-sm font-semibold">Backing track</h2>
            <div className="flex gap-2">
              <Input
                value={videoInput}
                placeholder="YouTube link or ID"
                onChange={(event) => setVideoInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && loadVideo()}
                className="h-8"
              />
              <Button size="sm" className="h-8" onClick={loadVideo}>
                Load
              </Button>
            </div>
            <div className="mt-3">
              <YouTubePlayer videoId={videoId} controllerRef={ytRef} />
            </div>
          </section>

          <section className="panel p-3">
            <h2 className="mb-2 text-sm font-semibold">Input level</h2>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-75"
                style={{ width: `${Math.round(studio.level * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {studio.isRecording
                ? "Recording — the existing mix plays back so you can overdub in time."
                : "Arm a track and hit record to capture a take."}
            </p>
          </section>

          {selected && (
            <section className="panel space-y-2 p-3">
              <h2 className="text-sm font-semibold">Selected clip</h2>
              <p className="text-xs text-muted-foreground">
                {selected.track.name} · {selected.clip.duration.toFixed(2)}s at{" "}
                {selected.clip.start.toFixed(2)}s
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => studio.duplicateClip(selected.track.id, selected.clip.id)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => studio.deleteClip(selected.track.id, selected.clip.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </section>
          )}
        </aside>

        <section className="panel flex min-h-[520px] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <Button
              size="icon"
              variant={studio.isRecording ? "destructive" : "secondary"}
              onClick={() => void toggleRecord()}
              aria-label={studio.isRecording ? "Stop recording" : "Record"}
            >
              {studio.isRecording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4 fill-destructive text-destructive" />
              )}
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={() => (studio.isPlaying ? studio.stop() : studio.play())}
              aria-label={studio.isPlaying ? "Pause" : "Play"}
              disabled={studio.isRecording}
            >
              {studio.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => studio.seek(0)} aria-label="Rewind">
              <Square className="h-3 w-3" />
            </Button>
            <span className="mx-2 h-5 w-px bg-border" />
            <Button size="sm" variant="ghost" onClick={studio.splitAtPlayhead}>
              <Scissors className="mr-1 h-4 w-4" /> Split
            </Button>
            <Button size="sm" variant="ghost" onClick={studio.addTrack}>
              <Layers className="mr-1 h-4 w-4" /> Add track
            </Button>
            <Button size="icon" variant="ghost" onClick={studio.undo} aria-label="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={studio.redo} aria-label="Redo">
              <Redo2 className="h-4 w-4" />
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Zoom out"
                onClick={() => setPxPerSecond((v) => Math.max(16, v / 1.4))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Zoom in"
                onClick={() => setPxPerSecond((v) => Math.min(320, v * 1.4))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading session…
            </div>
          ) : (
            <Tabs defaultValue="timeline" className="flex-1">
              <TabsList className="m-3">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="mixer">Mixer</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline">
                <Timeline studio={studio} pxPerSecond={pxPerSecond} />
              </TabsContent>
              <TabsContent value="mixer">
                <Mixer studio={studio} />
              </TabsContent>
            </Tabs>
          )}
        </section>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultTitle={title}
        buildMedia={buildMedia}
        onUploaded={(id) => {
          if (sessionId) void updateSession(sessionId, { uploaded_video_id: id });
        }}
      />
    </main>
  );
}
