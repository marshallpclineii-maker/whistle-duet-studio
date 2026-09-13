import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch, isWhistleFrequency, rmsLevel } from "@/lib/audio/pitch";
import { computePeaks } from "@/lib/audio/wav";
import { MasterMixer } from "@/lib/audio/mixer";

export interface CompletedTake {
  blob: Blob;
  durationMs: number;
  peaks: number[];
  pitchData: number[];
  autoDetected: boolean;
}

export interface RecorderOptions {
  onTake: (take: CompletedTake) => void;
  sensitivity: number; // 0..1, higher = easier trigger
  silenceMs: number;
  autoDetect: boolean;
}

type Status = "idle" | "listening" | "recording";

export function useRecorder(opts: RecorderOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [status, setStatus] = useState<Status>("idle");
  const [level, setLevel] = useState(0);
  const [pitch, setPitch] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [monitor, setMonitor] = useState(false);
  const [gain, setGain] = useState(1);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const mixerRef = useRef<MasterMixer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const hitsRef = useRef(0);
  const pitchTraceRef = useRef<number[]>([]);
  const autoRef = useRef(false);
  const statusRef = useRef<Status>("idle");
  const waveRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const liveLevelsRef = useRef<number[]>([]);

  const setStatusSafe = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => {
    if (mixerRef.current) {
      mixerRef.current.setMonitorEnabled(monitor);
    }
  }, [monitor]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, [gain]);

  const stopRecorder = useCallback((auto: boolean) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    autoRef.current = auto;
    rec.stop();
  }, []);

  const beginRecorder = useCallback((auto: boolean) => {
    const mixer = mixerRef.current;
    const stream = mixer ? mixer.recordingStream : streamRef.current;
    if (!stream || recorderRef.current?.state === "recording") return;
    
    const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    
    chunksRef.current = [];
    pitchTraceRef.current = [];
    liveLevelsRef.current = [];
    autoRef.current = auto;
    
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      const durationMs = performance.now() - startedAtRef.current;
      let peaks = liveLevelsRef.current.slice(0, 400);
      try {
        const ctx = ctxRef.current;
        if (ctx) {
          const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
          peaks = computePeaks(decoded, 400);
        }
      } catch {
        /* fall back to live levels */
      }
      setStatusSafe(streamRef.current ? "listening" : "idle");
      setElapsed(0);
      if (blob.size > 2000 && durationMs > 400) {
        optsRef.current.onTake({
          blob,
          durationMs,
          peaks,
          pitchData: pitchTraceRef.current.slice(0, 2000),
          autoDetected: autoRef.current,
        });
      }
    };
    
    rec.start(250);
    recorderRef.current = rec;
    startedAtRef.current = performance.now();
    setStatusSafe("recording");
  }, []);

  const loop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    if (!analyser || !ctx) return;
    if (!waveRef.current || waveRef.current.length !== analyser.fftSize) {
      waveRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    }
    const buf = waveRef.current;
    analyser.getFloatTimeDomainData(buf);

    const rms = rmsLevel(buf);
    setLevel(Math.min(1, rms * 6));

    const hz = detectPitch(buf, ctx.sampleRate);
    setPitch(hz);

    const o = optsRef.current;
    const whistling = hz > 0 && isWhistleFrequency(hz) && rms > 0.012 * (1.4 - o.sensitivity);
    const now = performance.now();

    if (statusRef.current === "recording") {
      liveLevelsRef.current.push(Math.min(1, rms * 6));
      pitchTraceRef.current.push(hz > 0 ? Math.round(hz) : 0);
      setElapsed(now - startedAtRef.current);
      if (whistling) lastVoiceRef.current = now;
      if (autoRef.current && now - lastVoiceRef.current > o.silenceMs) {
        stopRecorder(true);
      }
    } else if (statusRef.current === "listening" && o.autoDetect) {
      if (whistling) {
        hitsRef.current += 1;
        if (hitsRef.current > 4) {
          hitsRef.current = 0;
          lastVoiceRef.current = now;
          beginRecorder(true);
        }
      } else {
        hitsRef.current = Math.max(0, hitsRef.current - 1);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [beginRecorder, stopRecorder]);

  const arm = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      await ctx.resume();
      
      const src = ctx.createMediaStreamSource(stream);
      const mixer = new MasterMixer(ctx);
      mixerRef.current = mixer;

      const g = ctx.createGain();
      g.gain.value = gain;
      gainRef.current = g;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      src.connect(g);
      g.connect(analyser);
      g.connect(mixer.whistleBus);

      ctxRef.current = ctx;
      setStatusSafe("listening");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow the mic in your browser settings to record."
          : "Could not open the microphone on this device.",
      );
      setStatusSafe("idle");
import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch, isWhistleFrequency, rmsLevel } from "@/lib/audio/pitch";
import { computePeaks } from "@/lib/audio/wav";
import { MasterMixer } from "@/lib/audio/mixer";

export interface CompletedTake {
  blob: Blob;
  durationMs: number;
  peaks: number[];
  pitchData: number[];
  autoDetected: boolean;
}

export interface RecorderOptions {
  onTake: (take: CompletedTake) => void;
  sensitivity: number; // 0..1, higher = easier trigger
  silenceMs: number;
  autoDetect: boolean;
}

type Status = "idle" | "listening" | "recording";

export function useRecorder(opts: RecorderOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [status, setStatus] = useState<Status>("idle");
  const [level, setLevel] = useState(0);
  const [pitch, setPitch] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [monitor, setMonitor] = useState(false);
  const [gain, setGain] = useState(1);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const mixerRef = useRef<MasterMixer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const hitsRef = useRef(0);
  const pitchTraceRef = useRef<number[]>([]);
  const autoRef = useRef(false);
  const statusRef = useRef<Status>("idle");
  const waveRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const liveLevelsRef = useRef<number[]>([]);

  const setStatusSafe = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => {
    if (mixerRef.current) {
      mixerRef.current.setMonitorEnabled(monitor);
    }
  }, [monitor]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, [gain]);

  const stopRecorder = useCallback((auto: boolean) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    autoRef.current = auto;
    rec.stop();
  }, []);

  const beginRecorder = useCallback((auto: boolean) => {
    const mixer = mixerRef.current;
    const stream = mixer ? mixer.recordingStream : streamRef.current;
    if (!stream || recorderRef.current?.state === "recording") return;
    
    const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    
    chunksRef.current = [];
    pitchTraceRef.current = [];
    liveLevelsRef.current = [];
    autoRef.current = auto;
    
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      const durationMs = performance.now() - startedAtRef.current;
      let peaks = liveLevelsRef.current.slice(0, 400);
      try {
        const ctx = ctxRef.current;
        if (ctx) {
          const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
          peaks = computePeaks(decoded, 400);
        }
      } catch {
        /* fall back to live levels */
      }
      setStatusSafe(streamRef.current ? "listening" : "idle");
      setElapsed(0);
      if (blob.size > 2000 && durationMs > 400) {
        optsRef.current.onTake({
          blob,
          durationMs,
          peaks,
          pitchData: pitchTraceRef.current.slice(0, 2000),
          autoDetected: autoRef.current,
        });
      }
    };
    
    rec.start(250);
    recorderRef.current = rec;
    startedAtRef.current = performance.now();
    setStatusSafe("recording");
  }, []);

  const loop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    if (!analyser || !ctx) return;
    if (!waveRef.current || waveRef.current.length !== analyser.fftSize) {
      waveRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    }
    const buf = waveRef.current;
    analyser.getFloatTimeDomainData(buf);

    const rms = rmsLevel(buf);
    setLevel(Math.min(1, rms * 6));

    const hz = detectPitch(buf, ctx.sampleRate);
    setPitch(hz);

    const o = optsRef.current;
    const whistling = hz > 0 && isWhistleFrequency(hz) && rms > 0.012 * (1.4 - o.sensitivity);
    const now = performance.now();

    if (statusRef.current === "recording") {
      liveLevelsRef.current.push(Math.min(1, rms * 6));
      pitchTraceRef.current.push(hz > 0 ? Math.round(hz) : 0);
      setElapsed(now - startedAtRef.current);
      if (whistling) lastVoiceRef.current = now;
      if (autoRef.current && now - lastVoiceRef.current > o.silenceMs) {
        stopRecorder(true);
      }
    } else if (statusRef.current === "listening" && o.autoDetect) {
      if (whistling) {
        hitsRef.current += 1;
        if (hitsRef.current > 4) {
          hitsRef.current = 0;
          lastVoiceRef.current = now;
          beginRecorder(true);
        }
      } else {
        hitsRef.current = Math.max(0, hitsRef.current - 1);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [beginRecorder, stopRecorder]);

  const arm = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      await ctx.resume();
      
      const src = ctx.createMediaStreamSource(stream);
      const mixer = new MasterMixer(ctx);
      mixerRef.current = mixer;

      const g = ctx.createGain();
      g.gain.value = gain;
      gainRef.current = g;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      src.connect(g);
      g.connect(analyser);
      g.connect(mixer.whistleBus);

      ctxRef.current = ctx;
      setStatusSafe("listening");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow the mic in your browser settings to record."
          : "Could not open the microphone on this device.",
      );
      setStatusSafe("idle");
    }
  }, [gain, loop]);

  const disarm = useCallback(() => {
    stopRecorder(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mixerRef.current?.disconnect();
    mixerRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    analyserRef.current = null;
    setStatusSafe("idle");
    setLevel(0);
    setPitch(-1);
  }, [stopRecorder]);

  useEffect(() => () => disarm(), [disarm]);

  const toggleRecord = useCallback(async () => {
    if (statusRef.current === "recording") {
      stopRecorder(false);
      return;
    }
    if (statusRef.current === "idle") await arm();
    beginRecorder(false);
  }, [arm, beginRecorder, stopRecorder]);

  return {
    status,
    level,
    pitch,
    elapsed,
    error,
    arm,
    disarm,
    toggleRecord,
    monitor,
    setMonitor,
    gain,
    setGain,
  };
}
