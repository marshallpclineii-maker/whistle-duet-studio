import { emptyEffects, type EffectsState, type VoiceId } from "./effects";

export type Clip = {
  id: string;
  bufferId: string;
  /** Start position on the timeline, in seconds. */
  start: number;
  /** Offset into the source buffer, in seconds. */
  offset: number;
  /** Length of the clip, in seconds. */
  duration: number;
};

/** Unified tuning state: a whistle-to-instrument voice plus the effects rack. */
export type TrackEffects = {
  voice: VoiceId;
  rack: EffectsState;
};

export type Track = {
  id: string;
  name: string;
  color: string;
  clips: Clip[];
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
};

export type BufferRef = {
  id: string;
  /** Storage path inside the private `recordings` bucket, if saved. */
  path: string | null;
  duration: number;
};

export type Arrangement = {
  tracks: Track[];
  buffers: BufferRef[];
};

export const defaultEffects = (): TrackEffects => ({
  voice: "raw",
  rack: emptyEffects(),
});

export const trackColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function makeTrack(index: number): Track {
  return {
    id: crypto.randomUUID(),
    name: `Track ${index + 1}`,
    color: trackColors[index % trackColors.length] as string,
    clips: [],
    volume: 0.9,
    pan: 0,
    muted: false,
    solo: false,
    effects: defaultEffects(),
  };
}

export function arrangementDuration(tracks: Track[]): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, clip.start + clip.duration);
    }
  }
  return max;
}
