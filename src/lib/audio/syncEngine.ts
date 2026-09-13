import { buildChain, VOICE_RECIPES, type EffectsState } from "./effects";
import { encodeWav } from "./wav";
import type { Track, TrackEffects } from "./arrangement";

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor({ sampleRate: 44100 });
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export async function requestMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 44100,
    },
  });
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer();
  return getAudioContext().decodeAudioData(bytes);
}

/** Downsample a buffer into min/max peak pairs for waveform drawing. */
export function computeWavePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const data = buffer.getChannelData(0);
  const peaks = new Float32Array(buckets * 2);
  const step = Math.max(1, Math.floor(data.length / buckets));
  for (let i = 0; i < buckets; i++) {
    let min = 1;
    let max = -1;
    const start = i * step;
    const end = Math.min(data.length, start + step);
    for (let j = start; j < end; j++) {
      const v = data[j] as number;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (start >= end) {
      min = 0;
      max = 0;
    }
    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }
  return peaks;
}

/** Voice recipe underneath, hand-tweaked rack on top. */
export function mergedEffects(effects: TrackEffects): EffectsState {
  return { ...(VOICE_RECIPES[effects.voice] ?? {}), ...effects.rack };
}

export type TrackChain = {
  input: AudioNode;
  /** Playback-rate multiplier the pitch effect asks for. */
  rate: number;
};

/** rack chain -> pan -> volume -> destination. */
export function buildTrackChain(
  context: BaseAudioContext,
  effects: TrackEffects,
  volume: number,
  pan: number,
  destination: AudioNode,
): TrackChain {
  const chain = buildChain(context, mergedEffects(effects));

  const panner = context.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));

  const gain = context.createGain();
  gain.gain.value = volume;

  chain.output.connect(panner);
  panner.connect(gain);
  gain.connect(destination);

  return { input: chain.input, rate: chain.rateMultiplier };
}

export function audibleTracks(tracks: Track[]): Track[] {
  const soloed = tracks.filter((t) => t.solo);
  const pool = soloed.length > 0 ? soloed : tracks;
  return pool.filter((t) => !t.muted);
}

/** Render every clip through its track chain into a single offline buffer. */
export async function renderMix(
  tracks: Track[],
  buffers: Map<string, AudioBuffer>,
  duration: number,
): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(duration * 44100));
  const offline = new OfflineAudioContext(2, length, 44100);
  for (const track of audibleTracks(tracks)) {
    const chain = buildTrackChain(
      offline,
      track.effects,
      track.volume,
      track.pan,
      offline.destination,
    );
    for (const clip of track.clips) {
      const buffer = buffers.get(clip.bufferId);
      if (!buffer) continue;
      const source = offline.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = chain.rate;
      source.connect(chain.input);
      source.start(clip.start, clip.offset, clip.duration * chain.rate);
    }
  }
  return offline.startRendering();
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  return encodeWav(buffer);
}
