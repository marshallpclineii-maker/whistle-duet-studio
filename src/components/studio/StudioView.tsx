import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Layers,
  Play,
  Plus,
  Scissors,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Knob } from "@/components/console/Knob";
import { Fader, Meter } from "@/components/console/Meter";
import { supabase } from "@/integrations/supabase/client";
import { listTakes, loadProject, takeUrl, type FullProject } from "@/lib/db";
import { formatTime } from "@/lib/audio/wav";
import {
  EFFECT_DEFS,
  VOICES,
  defaultEffectParams,
  type EffectId,
  type EffectsState,
  type VoiceId,
} from "@/lib/audio/effects";
import {
  StudioEngine,
  projectDurationMs,
  type TrackSpec,
} from "@/lib/audio/studioEngine";
import { cn } from "@/lib/utils";

const PX_PER_SEC = 60;

interface TrackState {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  voice: VoiceId;
  chain: EffectsState;
  clips: ClipState[];
}

interface ClipState {
  id: string;
  name: string;
  takeId: string | null;
  storagePath: string | null;
  startMs: number;
  offsetMs: number;
  durationMs: number;
  gain: number;
  fadeInMs: number;
  fadeOutMs: number;
  peaks: number[];
}

function parseEffects(raw: unknown): { voice: VoiceId; chain: EffectsState } {
  const obj = (raw ?? {}) as { voice?: string; chain?: EffectsState };
  const voice = VOICES.some((v) => v.id === obj.voice) ? (obj.voice as VoiceId) : "raw";
  return { voice, chain: obj.chain ?? {} };
}

function toState(full: FullProject): TrackState[] {
  return full.tracks.map((t) => {
    const { voice, chain } = parseEffects(t.effects);
    return {
      id: t.id,
      name: t.name,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      soloed: t.soloed,
      voice,
      chain,
      clips: t.clips.map((c) => ({
        id: c.id,
        name: c.name,
        takeId: c.take_id,
        storagePath: c.take?.storage_path ?? null,
        startMs: c.start_ms,
        offsetMs: c.offset_ms,
        durationMs: c.duration_ms,
        gain: c.gain,
        fadeInMs: c.fade_in_ms,
        fadeOutMs: c.fade_out_ms,
        peaks: Array.isArray(c.take?.peaks) ? (c.take.peaks as number[]) : [],
      })),
    };
  });
}

function ClipBlock({
  clip,
  selected,
  onSelect,
  onMove,
}: {
  clip: ClipState;
  selected: boolean;
  onSelect: () => void;
  onMove: (ms: number) => void;
}) {
  const drag = useRef<{ x: number; start: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const deltaMs = ((e.clientX - d.x) / PX_PER_SEC) * 1000;
      onMove(Math.max(0, Math.round(d.start + deltaMs)));
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onMove]);

  const width = Math.max(24, (clip.durationMs / 1000) * PX_PER_SEC);
  const left = (clip.startMs / 1000) * PX_PER_SEC;
  const slice = clip.peaks.length
    ? clip.peaks.slice(
        Math.floor((clip.offsetMs / (clip.offsetMs + clip.durationMs || 1)) * clip.peaks.length),
      )
    : [];

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      onPointerDown={(e) => {
        onSelect();
        drag.current = { x: e.clientX, start: clip.startMs };
      }}
      className={cn(
        "absolute top-1 flex h-[58px] cursor-grab select-none flex-col overflow-hidden rounded-sm border bg-primary/15 px-1.5 py-1 active:cursor-grabbing",
        selected ? "border-primary shadow-knob" : "border-primary/40",
      )}
      style={{ left, width }}
    >
      <span className="truncate text-[10px] font-medium text-primary">{clip.name}</span>
      <div className="flex flex-1 items-center gap-[1px]">
        {slice.slice(0, Math.max(4, Math.floor(width / 3))).map((p, i) => (
          <span
            key={i}
            className="flex-1 rounded-[1px] bg-primary/70"
            style={{ height: `${Math.max(6, p * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function StudioView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => loadProject(projectId),
  });
  const { data: takes = [] } = useQuery({ queryKey: ["takes"], queryFn: listTakes });

  const [tracks, setTracks] = useState<TrackState[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const engineRef = useRef<StudioEngine | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (data) {
      const st = toState(data);
      setTracks(st);
      setSelectedTrack((cur) => cur ?? st[0]?.id ?? null);
    }
  }, [data]);

  useEffect(() => {
    engineRef.current = new StudioEngine();
    return () => {
      engineRef.current?.dispose();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const specs: TrackSpec[] = useMemo(
    () =>
      tracks.map((t) => ({
        id: t.id,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted,
        solo: t.soloed,
        effects: t.chain,
        voice: t.voice,
        clips: t.clips
          .filter((c) => c.takeId)
          .map((c) => ({
            id: c.id,
            takeId: c.takeId!,
            startMs: c.startMs,
            offsetMs: c.offsetMs,
            durationMs: c.durationMs,
            gain: c.gain,
            fadeInMs: c.fadeInMs,
            fadeOutMs: c.fadeOutMs,
          })),
      })),
    [tracks],
  );

  const totalMs = Math.max(30000, projectDurationMs(specs) + 5000);

  const ensureBuffers = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const needed = tracks.flatMap((t) =>
      t.clips.filter((c) => c.takeId && c.storagePath).map((c) => [c.takeId!, c.storagePath!] as const),
    );
    for (const [takeId, path] of needed) {
      if (engine.buffers.has(takeId)) continue;
      await engine.loadTake(takeId, await takeUrl(path));
    }
  }, [tracks]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const play = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await ensureBuffers();
    await engine.play(specs, playhead);
    setPlaying(true);
    const tick = () => {
      const pos = engine.positionMs();
      setPlayhead(pos);
      if (pos > totalMs) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureBuffers, playhead, specs, stop, totalMs]);

  const patchTrack = (id: string, patch: Partial<TrackState>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const next = tracks.find((t) => t.id === id);
    if (!next) return;
    const merged = { ...next, ...patch };
    void supabase
      .from("studio_tracks")
      .update({
        name: merged.name,
        volume: merged.volume,
        pan: merged.pan,
        muted: merged.muted,
        soloed: merged.soloed,
        effects: { voice: merged.voice, chain: merged.chain },
      })
      .eq("id", id);
  };

  const patchClip = (trackId: string, clipId: string, patch: Partial<ClipState>) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) }
          : t,
      ),
    );
    void supabase
      .from("project_clips")
      .update({
        start_ms: patch.startMs,
        offset_ms: patch.offsetMs,
        duration_ms: patch.durationMs,
        gain: patch.gain,
        fade_in_ms: patch.fadeInMs,
        fade_out_ms: patch.fadeOutMs,
        name: patch.name,
      })
      .eq("id", clipId);
  };

  const addTrack = async () => {
    const { data: row, error } = await supabase
      .from("studio_tracks")
      .insert({
        project_id: projectId,
        name: `Track ${tracks.length + 1}`,
        order_index: tracks.length,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setTracks((prev) => [
      ...prev,
      {
        id: row.id,
        name: row.name,
        volume: row.volume,
        pan: row.pan,
        muted: row.muted,
        soloed: row.soloed,
        voice: "raw",
        chain: {},
        clips: [],
      },
    ]);
  };

  const addClip = async (takeId: string) => {
    const track = tracks.find((t) => t.id === selectedTrack) ?? tracks[0];
    if (!track) return toast.error("Add a track first");
    const take = takes.find((t) => t.id === takeId);
    if (!take) return;
    const { data: row, error } = await supabase
      .from("project_clips")
      .insert({
        studio_track_id: track.id,
        take_id: take.id,
        name: take.title,
        start_ms: Math.round(playhead),
        offset_ms: 0,
        duration_ms: take.duration_ms,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setTracks((prev) =>
      prev.map((t) =>
        t.id === track.id
          ? {
              ...t,
              clips: [
                ...t.clips,
                {
                  id: row.id,
                  name: row.name,
                  takeId: take.id,
                  storagePath: take.storage_path,
                  startMs: row.start_ms,
                  offsetMs: row.offset_ms,
                  durationMs: row.duration_ms,
                  gain: row.gain,
                  fadeInMs: row.fade_in_ms,
                  fadeOutMs: row.fade_out_ms,
                  peaks: Array.isArray(take.peaks) ? (take.peaks as number[]) : [],
                },
              ],
            }
          : t,
      ),
    );
    setPickerOpen(false);
  };

  const splitAtPlayhead = async () => {
    const track = tracks.find((t) => t.clips.some((c) => c.id === selectedClip));
    const clip = track?.clips.find((c) => c.id === selectedClip);
    if (!track || !clip) return toast.error("Select a clip to splice");
    const cut = playhead - clip.startMs;
    if (cut <= 50 || cut >= clip.durationMs - 50) {
      return toast.error("Move the playhead inside the clip to splice it");
    }
    const { data: row, error } = await supabase
      .from("project_clips")
      .insert({
        studio_track_id: track.id,
        take_id: clip.takeId,
        name: `${clip.name} B`,
        start_ms: Math.round(clip.startMs + cut),
        offset_ms: Math.round(clip.offsetMs + cut),
        duration_ms: Math.round(clip.durationMs - cut),
        gain: clip.gain,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    patchClip(track.id, clip.id, { durationMs: Math.round(cut), fadeOutMs: clip.fadeOutMs });
    setTracks((prev) =>
      prev.map((t) =>
        t.id === track.id
          ? {
              ...t,
              clips: [
                ...t.clips,
                {
                  id: row.id,
                  name: row.name,
                  takeId: clip.takeId,
                  storagePath: clip.storagePath,
                  startMs: row.start_ms,
                  offsetMs: row.offset_ms,
                  durationMs: row.duration_ms,
                  gain: row.gain,
                  fadeInMs: row.fade_in_ms,
                  fadeOutMs: row.fade_out_ms,
                  peaks: clip.peaks,
                },
              ],
            }
          : t,
      ),
    );
    toast.success("Clip spliced");
  };

  const deleteClip = async () => {
    if (!selectedClip) return;
    await supabase.from("project_clips").delete().eq("id", selectedClip);
    setTracks((prev) =>
      prev.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== selectedClip) })),
    );
    setSelectedClip(null);
  };

  const bounce = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    setRendering(true);
    try {
      await ensureBuffers();
      const blob = await engine.render(specs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data?.project.name ?? "whistledeck"}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Mix exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setRendering(false);
    }
  };

  const active = tracks.find((t) => t.id === selectedTrack) ?? null;
  const activeClip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClip) ?? null;
  const activeClipTrack = tracks.find((t) => t.clips.some((c) => c.id === selectedClip)) ?? null;

  if (isLoading) return <p className="text-sm text-muted-foreground">Opening session…</p>;

  return (
    <div className="space-y-4">
      <div className="panel brushed flex flex-wrap items-center gap-3 p-3">
        <Button onClick={() => (playing ? stop() : void play())} className="gap-2 min-w-28">
          {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Stop" : "Play"}
        </Button>
        <span className="readout text-xl tabular-nums text-primary">{formatTime(playhead)}</span>
        <Button variant="secondary" className="gap-2" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" /> Overdub take
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => void splitAtPlayhead()}>
          <Scissors className="h-4 w-4" /> Splice
        </Button>
        <Button variant="ghost" className="gap-2" onClick={() => void deleteClip()}>
          <Trash2 className="h-4 w-4" /> Delete clip
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => void addTrack()}>
          <Layers className="h-4 w-4" /> Add track
        </Button>
        <Button
          variant="outline"
          className="ml-auto gap-2"
          disabled={rendering}
          onClick={() => void bounce()}
        >
          <Download className="h-4 w-4" /> {rendering ? "Bouncing…" : "Export mix"}
        </Button>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex">
          <div className="w-44 shrink-0 border-r border-border">
            <div className="h-7 border-b border-border bg-rail px-2 text-[10px] uppercase leading-7 tracking-wider text-muted-foreground">
              Tracks
            </div>
            {tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrack(t.id)}
                className={cn(
                  "flex h-[66px] w-full flex-col justify-center gap-1 border-b border-border px-2 text-left",
                  selectedTrack === t.id ? "bg-panel-raised" : "hover:bg-panel-raised/50",
                )}
              >
                <span className="truncate text-xs font-medium">{t.name}</span>
                <span className="flex gap-1">
                  <span
                    className={cn(
                      "rounded-sm px-1 text-[10px]",
                      t.muted ? "bg-destructive text-destructive-foreground" : "bg-rail text-muted-foreground",
                    )}
                  >
                    M
                  </span>
                  <span
                    className={cn(
                      "rounded-sm px-1 text-[10px]",
                      t.soloed ? "bg-primary text-primary-foreground" : "bg-rail text-muted-foreground",
                    )}
                  >
                    S
                  </span>
                  <span className="rounded-sm bg-rail px-1 text-[10px] text-muted-foreground">
                    {VOICES.find((v) => v.id === t.voice)?.label}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div
            className="relative flex-1 overflow-x-auto"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
              setPlayhead(Math.max(0, (x / PX_PER_SEC) * 1000));
            }}
          >
            <div style={{ width: (totalMs / 1000) * PX_PER_SEC }}>
              <div className="flex h-7 border-b border-border bg-rail">
                {Array.from({ length: Math.ceil(totalMs / 1000) }, (_, s) => (
                  <div
                    key={s}
                    className="shrink-0 border-r border-border/40 text-[9px] text-muted-foreground"
                    style={{ width: PX_PER_SEC }}
                  >
                    {s % 5 === 0 ? <span className="pl-1">{s}s</span> : null}
                  </div>
                ))}
              </div>
              {tracks.map((t) => (
                <div key={t.id} className="relative h-[66px] border-b border-border">
                  {t.clips.map((c) => (
                    <ClipBlock
                      key={c.id}
                      clip={c}
                      selected={selectedClip === c.id}
                      onSelect={() => {
                        setSelectedClip(c.id);
                        setSelectedTrack(t.id);
                      }}
                      onMove={(ms) => patchClip(t.id, c.id, { startMs: ms })}
                    />
                  ))}
                </div>
              ))}
              <div
                className="pointer-events-none absolute top-0 h-full w-px bg-destructive"
                style={{ left: (playhead / 1000) * PX_PER_SEC }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="panel brushed p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest">
            <Volume2 className="h-4 w-4 text-primary" /> Mixer
          </h2>
          <div className="flex gap-4 overflow-x-auto">
            {tracks.map((t) => (
              <div key={t.id} className="flex w-20 shrink-0 flex-col items-center gap-2">
                <Input
                  value={t.name}
                  onChange={(e) => patchTrack(t.id, { name: e.target.value })}
                  className="h-6 bg-rail px-1 text-center text-[10px]"
                />
                <div className="flex h-32 gap-2">
                  <Meter level={t.muted ? 0 : t.volume / 1.5} />
                  <Fader
                    value={t.volume}
                    label={`${t.name} level`}
                    onChange={(v) => patchTrack(t.id, { volume: v })}
                  />
                </div>
                <Knob
                  label="Pan"
                  value={t.pan}
                  min={-1}
                  max={1}
                  step={0.05}
                  size={34}
                  onChange={(v) => patchTrack(t.id, { pan: v })}
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={t.muted ? "destructive" : "secondary"}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => patchTrack(t.id, { muted: !t.muted })}
                  >
                    M
                  </Button>
                  <Button
                    size="sm"
                    variant={t.soloed ? "default" : "secondary"}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => patchTrack(t.id, { soloed: !t.soloed })}
                  >
                    S
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel brushed p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              Effects rack — {active?.name ?? "no track"}
            </h2>
            <div className="ml-auto flex flex-wrap gap-1">
              {VOICES.map((v) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={active?.voice === v.id ? "default" : "secondary"}
                  className="h-7 text-[10px] uppercase"
                  onClick={() => active && patchTrack(active.id, { voice: v.id })}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          </div>

          {active ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {EFFECT_DEFS.map((def) => {
                const state = active.chain[def.id];
                const on = !!state?.on;
                const params = { ...defaultEffectParams(def.id), ...(state?.params ?? {}) };
                return (
                  <div key={def.id} className="rounded-md border border-border bg-panel-raised p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {def.label}
                      </span>
                      <Switch
                        className="ml-auto"
                        checked={on}
                        onCheckedChange={(checked) =>
                          patchTrack(active.id, {
                            chain: {
                              ...active.chain,
                              [def.id as EffectId]: { on: checked, params },
                            },
                          })
                        }
                      />
                    </div>
                    <p className="mb-2 text-[10px] text-muted-foreground">{def.blurb}</p>
                    <div className={cn("flex flex-wrap gap-1", !on && "opacity-40")}>
                      {def.params.map((p) => (
                        <Knob
                          key={p.key}
                          label={p.label}
                          value={params[p.key] ?? p.def}
                          min={p.min}
                          max={p.max}
                          step={p.step}
                          {...(p.unit ? { unit: p.unit } : {})}
                          size={38}
                          onChange={(v) =>
                            patchTrack(active.id, {
                              chain: {
                                ...active.chain,
                                [def.id as EffectId]: {
                                  on,
                                  params: { ...params, [p.key]: v },
                                },
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {activeClip && activeClipTrack ? (
            <div className="mt-4 rounded-md border border-border bg-panel-raised p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider">
                Clip — {activeClip.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Knob
                  label="Gain"
                  value={activeClip.gain}
                  min={0}
                  max={2}
                  step={0.05}
                  onChange={(v) => patchClip(activeClipTrack.id, activeClip.id, { gain: v })}
                />
                <Knob
                  label="Fade in"
                  value={activeClip.fadeInMs}
                  min={0}
                  max={4000}
                  step={50}
                  unit="ms"
                  onChange={(v) => patchClip(activeClipTrack.id, activeClip.id, { fadeInMs: v })}
                />
                <Knob
                  label="Fade out"
                  value={activeClip.fadeOutMs}
                  min={0}
                  max={4000}
                  step={50}
                  unit="ms"
                  onChange={(v) => patchClip(activeClipTrack.id, activeClip.id, { fadeOutMs: v })}
                />
                <Knob
                  label="Trim"
                  value={activeClip.durationMs}
                  min={200}
                  max={Math.max(1000, activeClip.durationMs + activeClip.offsetMs + 5000)}
                  step={50}
                  unit="ms"
                  onChange={(v) =>
                    patchClip(activeClipTrack.id, activeClip.id, { durationMs: v })
                  }
                />
                <Knob
                  label="Start"
                  value={activeClip.startMs}
                  min={0}
                  max={120000}
                  step={50}
                  unit="ms"
                  onChange={(v) => patchClip(activeClipTrack.id, activeClip.id, { startMs: v })}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Overdub a take onto {active?.name ?? "the session"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {takes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No takes recorded yet.</p>
            ) : (
              takes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => void addClip(t.id)}
                  className="flex w-full items-center gap-3 rounded-md border border-border bg-panel-raised px-3 py-2 text-left hover:border-primary"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.tracks?.title ?? "Untagged"}
                    </span>
                  </span>
                  <span className="readout text-xs text-primary">
                    {formatTime(t.duration_ms)}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-muted-foreground">
        Drag clips to slide them in time, click the ruler to move the playhead, then splice at
        the playhead to cut a take in two. Everything saves to your cloud account as you go.
        <span className="sr-only">{qc ? "" : ""}</span>
      </p>
    </div>
  );
}

export { toState as _toState };

export function _unusedLabel() {
  return Label;
}
