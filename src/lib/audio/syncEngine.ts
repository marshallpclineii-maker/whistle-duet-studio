import type { Track, TrackEffects } from "./types";

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
export function computePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
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

function makeImpulse(context: BaseAudioContext, seconds = 2.4, decay = 3): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = context.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const channel = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export type TrackChain = {
  input: GainNode;
  gain: GainNode;
};

/** Build gain -> pan -> filter -> (dry + reverb/delay sends) -> destination. */
export function buildTrackChain(
  context: BaseAudioContext,
  effects: TrackEffects,
  volume: number,
  pan: number,
  destination: AudioNode,
): TrackChain {
  const input = context.createGain();
  const gain = context.createGain();
  gain.gain.value = volume;

  const panner = context.createStereoPanner();
  panner.pan.value = pan;

  input.connect(gain);
  gain.connect(panner);

  let tail: AudioNode = panner;
  if (effects.filterType !== "off") {
    const filter = context.createBiquadFilter();
    filter.type = effects.filterType;
    filter.frequency.value = effects.filterFreq;
    panner.connect(filter);
    tail = filter;
  }

  tail.connect(destination);

  if (effects.reverb > 0) {
    const convolver = context.createConvolver();
    convolver.buffer = makeImpulse(context);
    const send = context.createGain();
    send.gain.value = effects.reverb;
    tail.connect(send);
    send.connect(convolver);
    convolver.connect(destination);
  }

  if (effects.delay > 0) {
    const delay = context.createDelay(2);
    delay.delayTime.value = 0.34;
    const feedback = context.createGain();
    feedback.gain.value = 0.32;
    const send = context.createGain();
    send.gain.value = effects.delay;
    tail.connect(send);
    send.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(destination);
  }

  return { input, gain };
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
      source.connect(chain.input);
      source.start(clip.start, clip.offset, clip.duration);
    }
  }
  return offline.startRendering();
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const rate = buffer.sampleRate;
  const frames = buffer.length;
  const bytes = 44 + frames * numChannels * 2;
  const view = new DataView(new ArrayBuffer(bytes));

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, frames * numChannels * 2, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, (channels[c] as Float32Array)[i] as number));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view.buffer], { type: "audio/wav" });
}
