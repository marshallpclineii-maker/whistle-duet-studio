/**
 * Pitch detection + whistle onset detection.
 * Autocorrelation (ACF2+) — good enough for a clean whistle tone.
 */

export const WHISTLE_MIN_HZ = 480;
export const WHISTLE_MAX_HZ = 4200;

/** Returns fundamental frequency in Hz, or -1 if no confident pitch. */
export function detectPitch(buf: Float32Array, sampleRate: number): number {
  const size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i]! * buf[i]!;
  rms = Math.sqrt(rms / size);
  if (rms < 0.006) return -1;

  let r1 = 0;
  let r2 = size - 1;
  const thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buf[i]!) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buf[size - i]!) < thres) {
      r2 = size - i;
      break;
    }
  }
  const trimmed = buf.slice(r1, r2);
  const n = trimmed.length;
  if (n < 128) return -1;

  const c = new Float32Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) c[i] = c[i]! + trimmed[j]! * trimmed[j + i]!;
  }

  let d = 0;
  while (d < n - 1 && c[d]! > c[d + 1]!) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < n; i++) {
    if (c[i]! > maxval) {
      maxval = c[i]!;
      maxpos = i;
    }
  }
  if (maxpos <= 0) return -1;

  let t0 = maxpos;
  const x1 = c[t0 - 1] ?? 0;
  const x2 = c[t0] ?? 0;
  const x3 = c[t0 + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) t0 = t0 - b / (2 * a);

  const freq = sampleRate / t0;
  if (!Number.isFinite(freq) || freq < 40 || freq > 8000) return -1;
  return freq;
}

export function isWhistleFrequency(hz: number): boolean {
  return hz >= WHISTLE_MIN_HZ && hz <= WHISTLE_MAX_HZ;
}

export function rmsLevel(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
  return Math.sqrt(sum / buf.length);
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function hzToNote(hz: number): string {
  if (hz <= 0) return "--";
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${name}${Math.floor(midi / 12) - 1}`;
}
