import { buildChain, VOICE_RECIPES, type EffectsState, type VoiceId } from "./effects";
import { encodeWav } from "./wav";

export interface ClipSpec {
  id: string;
  takeId: string;
  startMs: number;
  offsetMs: number;
  durationMs: number;
  gain: number;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface TrackSpec {
  id: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effects: EffectsState;
  voice: VoiceId;
  clips: ClipSpec[];
}

function mergedEffects(track: TrackSpec): EffectsState {
  return { ...(VOICE_RECIPES[track.voice] ?? {}), ...track.effects };
}

function audibleTracks(tracks: TrackSpec[]): TrackSpec[] {
  const soloed = tracks.some((t) => t.solo);
  return tracks.filter((t) => !t.muted && (!soloed || t.solo));
}

export function projectDurationMs(tracks: TrackSpec[]): number {
  let end = 0;
  for (const t of tracks) {
    for (const c of t.clips) end = Math.max(end, c.startMs + c.durationMs);
  }
  return end;
}

/** Schedules every clip of every track on the given context. */
function schedule(
  ctx: BaseAudioContext,
  destination: AudioNode,
  tracks: TrackSpec[],
  fromMs: number,
  when: number,
  buffers: Map<string, AudioBuffer>,
): AudioBufferSourceNode[] {
  const sources: AudioBufferSourceNode[] = [];

  for (const track of audibleTracks(tracks)) {
    const chain = buildChain(ctx, mergedEffects(track));
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, track.pan));
    const vol = ctx.createGain();
    vol.gain.value = track.volume;
    chain.output.connect(panner);
    panner.connect(vol);
    vol.connect(destination);

    for (const clip of track.clips) {
      const buffer = buffers.get(clip.takeId);
      if (!buffer) continue;
      const clipEnd = clip.startMs + clip.durationMs;
      if (clipEnd <= fromMs) continue;

      const rate = chain.rateMultiplier;
      const skipMs = Math.max(0, fromMs - clip.startMs);
      const startAt = when + Math.max(0, clip.startMs - fromMs) / 1000;
      const offsetSec = (clip.offsetMs + skipMs) / 1000;
      const playMs = clip.durationMs - skipMs;
      if (playMs <= 0) continue;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;

      const env = ctx.createGain();
      env.gain.value = clip.gain;
      const fadeIn = Math.min(clip.fadeInMs, playMs) / 1000;
      const fadeOut = Math.min(clip.fadeOutMs, playMs) / 1000;
      const durSec = playMs / 1000 / rate;
      if (fadeIn > 0) {
        env.gain.setValueAtTime(0, startAt);
        env.gain.linearRampToValueAtTime(clip.gain, startAt + fadeIn / rate);
      }
      if (fadeOut > 0) {
        env.gain.setValueAtTime(clip.gain, startAt + durSec - fadeOut / rate);
        env.gain.linearRampToValueAtTime(0, startAt + durSec);
      }

      src.connect(env);
      env.connect(chain.input);
      src.start(startAt, offsetSec / rate, durSec * rate);
      sources.push(src);
    }
  }

  return sources;
}

export class StudioEngine {
  private ctx: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private startCtxTime = 0;
  private startOffsetMs = 0;
  readonly buffers = new Map<string, AudioBuffer>();

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async loadTake(takeId: string, url: string): Promise<AudioBuffer> {
    const existing = this.buffers.get(takeId);
    if (existing) return existing;
    const res = await fetch(url);
    const buf = await this.context().decodeAudioData(await res.arrayBuffer());
    this.buffers.set(takeId, buf);
    return buf;
  }

  get playing(): boolean {
    return this.sources.length > 0;
  }

  async play(tracks: TrackSpec[], fromMs: number): Promise<void> {
    this.stop();
    const ctx = this.context();
    await ctx.resume();
    const when = ctx.currentTime + 0.08;
    this.startCtxTime = when;
    this.startOffsetMs = fromMs;
    this.sources = schedule(ctx, ctx.destination, tracks, fromMs, when, this.buffers);
  }

  positionMs(): number {
    if (!this.ctx || !this.sources.length) return this.startOffsetMs;
    return this.startOffsetMs + (this.ctx.currentTime - this.startCtxTime) * 1000;
  }

  stop(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  /** Offline bounce of the whole session to a WAV blob. */
  async render(tracks: TrackSpec[]): Promise<Blob> {
    const totalMs = projectDurationMs(tracks) + 1500;
    const rate = 44100;
    const offline = new OfflineAudioContext(2, Math.ceil((totalMs / 1000) * rate), rate);
    schedule(offline, offline.destination, tracks, 0, 0, this.buffers);
    const rendered = await offline.startRendering();
    return encodeWav(rendered);
  }
}
