import { audibleTracks, buildTrackChain, getAudioContext } from "./syncEngine";
import type { Track } from "./arrangement";

/** Schedules every clip of every audible track relative to a shared start time. */
export class Player {
  private sources: AudioBufferSourceNode[] = [];
  private startedAt = 0;
  private startOffset = 0;
  private playing = false;

  isPlaying() {
    return this.playing;
  }

  currentTime() {
    if (!this.playing) return this.startOffset;
    return this.startOffset + (getAudioContext().currentTime - this.startedAt);
  }

  play(tracks: Track[], buffers: Map<string, AudioBuffer>, from: number, onEnded?: () => void) {
    this.stop();
    const ctx = getAudioContext();
    const now = ctx.currentTime + 0.06;
    this.startedAt = now;
    this.startOffset = from;
    this.playing = true;

    let last = 0;
    for (const track of audibleTracks(tracks)) {
      const chain = buildTrackChain(ctx, track.effects, track.volume, track.pan, ctx.destination);
      for (const clip of track.clips) {
        const buffer = buffers.get(clip.bufferId);
        if (!buffer) continue;
        const clipEnd = clip.start + clip.duration;
        if (clipEnd <= from) continue;
        const skip = Math.max(0, from - clip.start);
        const when = now + Math.max(0, clip.start - from);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = chain.rate;
        source.connect(chain.input);
        source.start(when, clip.offset + skip, (clip.duration - skip) * chain.rate);
        this.sources.push(source);
        last = Math.max(last, clipEnd);
      }
    }

    if (onEnded) {
      const remaining = Math.max(0.2, last - from) * 1000 + 120;
      window.setTimeout(() => {
        if (this.playing) onEnded();
      }, remaining);
    }
  }

  stop() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
    }
    this.sources = [];
    if (this.playing) {
      this.startOffset = this.currentTime();
      this.playing = false;
    }
  }

  seek(time: number) {
    this.stop();
    this.startOffset = time;
  }
}

export type RecorderHandle = {
  stream: MediaStream;
  recorder: MediaRecorder;
  analyser: AnalyserNode;
  stop: () => Promise<Blob>;
};

export async function createRecorder(stream: MediaStream): Promise<RecorderHandle> {
  const ctx = getAudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stop = () =>
    new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(new Blob(chunks, { type: "audio/webm" }));
    });

  return { stream, recorder, analyser, stop };
}
