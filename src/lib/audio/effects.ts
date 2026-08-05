/** Effect chain definitions + Web Audio graph builder. */

export type EffectId =
  | "eq"
  | "filter"
  | "reverb"
  | "delay"
  | "chorus"
  | "distortion"
  | "compressor"
  | "gate"
  | "pitch";

export type EffectSettings = Record<string, number>;
export type EffectsState = Partial<Record<EffectId, { on: boolean; params: EffectSettings }>>;

export interface EffectParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: string;
}

export interface EffectDef {
  id: EffectId;
  label: string;
  blurb: string;
  params: EffectParamDef[];
}

export const EFFECT_DEFS: EffectDef[] = [
  {
    id: "eq",
    label: "EQ",
    blurb: "Three-band tone shaping",
    params: [
      { key: "low", label: "Low", min: -24, max: 24, step: 1, def: 0, unit: "dB" },
      { key: "mid", label: "Mid", min: -24, max: 24, step: 1, def: 0, unit: "dB" },
      { key: "high", label: "High", min: -24, max: 24, step: 1, def: 0, unit: "dB" },
    ],
  },
  {
    id: "filter",
    label: "Filter",
    blurb: "Sweepable low/high pass",
    params: [
      { key: "mode", label: "Mode", min: 0, max: 1, step: 1, def: 0 },
      { key: "freq", label: "Freq", min: 60, max: 12000, step: 10, def: 2000, unit: "Hz" },
      { key: "q", label: "Res", min: 0.1, max: 18, step: 0.1, def: 1 },
    ],
  },
  {
    id: "reverb",
    label: "Reverb",
    blurb: "Room, hall, cathedral tail",
    params: [
      { key: "size", label: "Size", min: 0.2, max: 6, step: 0.1, def: 2, unit: "s" },
      { key: "decay", label: "Decay", min: 0.5, max: 8, step: 0.1, def: 2.5 },
      { key: "mix", label: "Mix", min: 0, max: 1, step: 0.01, def: 0.3 },
    ],
  },
  {
    id: "delay",
    label: "Delay",
    blurb: "Echo with feedback",
    params: [
      { key: "time", label: "Time", min: 0.02, max: 1.5, step: 0.01, def: 0.28, unit: "s" },
      { key: "feedback", label: "Fdbk", min: 0, max: 0.92, step: 0.01, def: 0.35 },
      { key: "mix", label: "Mix", min: 0, max: 1, step: 0.01, def: 0.3 },
    ],
  },
  {
    id: "chorus",
    label: "Chorus",
    blurb: "Detuned doubling",
    params: [
      { key: "rate", label: "Rate", min: 0.05, max: 8, step: 0.05, def: 1.2, unit: "Hz" },
      { key: "depth", label: "Depth", min: 0, max: 0.02, step: 0.0005, def: 0.004 },
      { key: "mix", label: "Mix", min: 0, max: 1, step: 0.01, def: 0.4 },
    ],
  },
  {
    id: "distortion",
    label: "Drive",
    blurb: "Saturation and grit",
    params: [
      { key: "amount", label: "Drive", min: 0, max: 100, step: 1, def: 25 },
      { key: "tone", label: "Tone", min: 500, max: 12000, step: 100, def: 6000, unit: "Hz" },
      { key: "mix", label: "Mix", min: 0, max: 1, step: 0.01, def: 0.6 },
    ],
  },
  {
    id: "compressor",
    label: "Comp",
    blurb: "Level control and glue",
    params: [
      { key: "threshold", label: "Thresh", min: -60, max: 0, step: 1, def: -22, unit: "dB" },
      { key: "ratio", label: "Ratio", min: 1, max: 20, step: 0.5, def: 4 },
      { key: "attack", label: "Attack", min: 0, max: 0.5, step: 0.005, def: 0.01, unit: "s" },
      { key: "release", label: "Rel", min: 0.02, max: 1.5, step: 0.01, def: 0.25, unit: "s" },
    ],
  },
  {
    id: "gate",
    label: "Gate",
    blurb: "Cuts hiss between phrases",
    params: [
      { key: "threshold", label: "Thresh", min: -80, max: -10, step: 1, def: -48, unit: "dB" },
    ],
  },
  {
    id: "pitch",
    label: "Pitch",
    blurb: "Transpose the whistle",
    params: [{ key: "semitones", label: "Semi", min: -24, max: 24, step: 1, def: 0 }],
  },
];

export const EFFECT_DEF_MAP: Record<EffectId, EffectDef> = Object.fromEntries(
  EFFECT_DEFS.map((d) => [d.id, d]),
) as Record<EffectId, EffectDef>;

export function defaultEffectParams(id: EffectId): EffectSettings {
  const out: EffectSettings = {};
  for (const p of EFFECT_DEF_MAP[id].params) out[p.key] = p.def;
  return out;
}

export function emptyEffects(): EffectsState {
  return {};
}

/** Whistle-to-instrument voices, implemented as filter + drive + reverb recipes. */
export const VOICES = [
  { id: "raw", label: "Raw whistle" },
  { id: "flute", label: "Flute" },
  { id: "synth", label: "Synth lead" },
  { id: "bell", label: "Bell" },
  { id: "bass", label: "Sub bass" },
  { id: "choir", label: "Choir" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];

export const VOICE_RECIPES: Record<VoiceId, EffectsState> = {
  raw: {},
  flute: {
    filter: { on: true, params: { mode: 0, freq: 3400, q: 0.7 } },
    reverb: { on: true, params: { size: 2.2, decay: 2.4, mix: 0.28 } },
    eq: { on: true, params: { low: -4, mid: 3, high: 1 } },
  },
  synth: {
    distortion: { on: true, params: { amount: 45, tone: 7000, mix: 0.7 } },
    chorus: { on: true, params: { rate: 1.6, depth: 0.006, mix: 0.5 } },
    delay: { on: true, params: { time: 0.24, feedback: 0.34, mix: 0.28 } },
  },
  bell: {
    pitch: { on: true, params: { semitones: 12 } },
    reverb: { on: true, params: { size: 4, decay: 5, mix: 0.45 } },
    eq: { on: true, params: { low: -8, mid: 0, high: 6 } },
  },
  bass: {
    pitch: { on: true, params: { semitones: -24 } },
    filter: { on: true, params: { mode: 0, freq: 900, q: 1.2 } },
    distortion: { on: true, params: { amount: 20, tone: 2000, mix: 0.5 } },
  },
  choir: {
    chorus: { on: true, params: { rate: 0.5, depth: 0.012, mix: 0.75 } },
    reverb: { on: true, params: { size: 5, decay: 6, mix: 0.5 } },
    eq: { on: true, params: { low: -2, mid: 2, high: -2 } },
  },
};

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const ch = impulse.getChannelData(c);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return impulse;
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const k = amount;
  const n = 44100;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export interface Chain {
  input: AudioNode;
  output: AudioNode;
  /** Playback-rate multiplier requested by the pitch effect (applied at the source). */
  rateMultiplier: number;
}

/** Builds a serial effect chain. Works on both AudioContext and OfflineAudioContext. */
export function buildChain(ctx: BaseAudioContext, effects: EffectsState): Chain {
  const input = ctx.createGain();
  let node: AudioNode = input;
  let rateMultiplier = 1;

  const wetDry = (make: () => { wetIn: AudioNode; wetOut: AudioNode }, mix: number) => {
    const split = ctx.createGain();
    node.connect(split);
    const dry = ctx.createGain();
    dry.gain.value = 1 - mix;
    const wet = ctx.createGain();
    wet.gain.value = mix;
    const { wetIn, wetOut } = make();
    split.connect(dry);
    split.connect(wetIn);
    wetOut.connect(wet);
    const merge = ctx.createGain();
    dry.connect(merge);
    wet.connect(merge);
    node = merge;
  };

  const get = (id: EffectId) => {
    const e = effects[id];
    if (!e?.on) return null;
    return { ...defaultEffectParams(id), ...e.params };
  };

  const gate = get("gate");
  if (gate) {
    // Approximated with a steep compressor acting as a downward expander guard.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = gate["threshold"]!;
    comp.knee.value = 0;
    comp.ratio.value = 1.2;
    comp.attack.value = 0.003;
    comp.release.value = 0.08;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 120;
    node.connect(hp);
    hp.connect(comp);
    node = comp;
  }

  const pitch = get("pitch");
  if (pitch) rateMultiplier = Math.pow(2, pitch["semitones"]! / 12);

  const eq = get("eq");
  if (eq) {
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 250;
    low.gain.value = eq["low"]!;
    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1400;
    mid.Q.value = 0.9;
    mid.gain.value = eq["mid"]!;
    const high = ctx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 4200;
    high.gain.value = eq["high"]!;
    node.connect(low);
    low.connect(mid);
    mid.connect(high);
    node = high;
  }

  const filter = get("filter");
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter["mode"] === 1 ? "highpass" : "lowpass";
    f.frequency.value = filter["freq"]!;
    f.Q.value = filter["q"]!;
    node.connect(f);
    node = f;
  }

  const dist = get("distortion");
  if (dist) {
    wetDry(() => {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(dist["amount"]!);
      shaper.oversample = "4x";
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = dist["tone"]!;
      shaper.connect(tone);
      return { wetIn: shaper, wetOut: tone };
    }, dist["mix"]!);
  }

  const chorus = get("chorus");
  if (chorus) {
    wetDry(() => {
      const delay = ctx.createDelay(0.1);
      delay.delayTime.value = 0.022;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = chorus["rate"]!;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = chorus["depth"]!;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();
      return { wetIn: delay, wetOut: delay };
    }, chorus["mix"]!);
  }

  const delayFx = get("delay");
  if (delayFx) {
    wetDry(() => {
      const d = ctx.createDelay(2);
      d.delayTime.value = delayFx["time"]!;
      const fb = ctx.createGain();
      fb.gain.value = delayFx["feedback"]!;
      d.connect(fb);
      fb.connect(d);
      return { wetIn: d, wetOut: d };
    }, delayFx["mix"]!);
  }

  const reverb = get("reverb");
  if (reverb) {
    wetDry(() => {
      const conv = ctx.createConvolver();
      conv.buffer = makeImpulse(ctx, reverb["size"]!, reverb["decay"]!);
      return { wetIn: conv, wetOut: conv };
    }, reverb["mix"]!);
  }

  const comp = get("compressor");
  if (comp) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = comp["threshold"]!;
    c.ratio.value = comp["ratio"]!;
    c.attack.value = comp["attack"]!;
    c.release.value = comp["release"]!;
    node.connect(c);
    node = c;
  }

  const output = ctx.createGain();
  node.connect(output);
  return { input, output, rateMultiplier };
}
