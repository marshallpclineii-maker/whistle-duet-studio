import { useCallback, useEffect, useRef, useState } from "react";
import {
  audioBufferToWav,
  computeWavePeaks,
  decodeBlob,
  getAudioContext,
  renderMix,
  requestMicStream,
} from "@/lib/audio/syncEngine";
import { createRecorder, Player, type RecorderHandle } from "@/lib/audio/syncPlayer";
import { arrangementDuration, makeTrack, type Clip, type Track } from "@/lib/audio/arrangement";

export type StudioOptions = {
  onRecordStart?: () => void;
  onRecordStop?: () => void;
  onPlay?: (time: number) => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
};

export function useStudio(options: StudioOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [tracks, setTracksState] = useState<Track[]>(() => []);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [peaksVersion, setPeaksVersion] = useState(0);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);

  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const peaksRef = useRef<Map<string, Float32Array>>(new Map());
  const playerRef = useRef<Player | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const recordStartRef = useRef(0);
  const recordTrackRef = useRef<string | null>(null);
  const historyRef = useRef<{ past: Track[][]; future: Track[][] }>({ past: [], future: [] });
  const rafRef = useRef<number | null>(null);

  const getPlayer = useCallback(() => {
    if (!playerRef.current) playerRef.current = new Player();
    return playerRef.current;
  }, []);

  const commit = useCallback((updater: (current: Track[]) => Track[]) => {
    setTracksState((current) => {
      historyRef.current.past.push(current);
      if (historyRef.current.past.length > 60) historyRef.current.past.shift();
      historyRef.current.future = [];
      return updater(current);
    });
  }, []);

  const undo = useCallback(() => {
    setTracksState((current) => {
      const previous = historyRef.current.past.pop();
      if (!previous) return current;
      historyRef.current.future.push(current);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setTracksState((current) => {
      const next = historyRef.current.future.pop();
      if (!next) return current;
      historyRef.current.past.push(current);
      return next;
    });
  }, []);

  const registerBuffer = useCallback((id: string, buffer: AudioBuffer) => {
    buffersRef.current.set(id, buffer);
    peaksRef.current.set(id, computeWavePeaks(buffer, 2000));
    setPeaksVersion((v) => v + 1);
  }, []);

  const getPeaks = useCallback((bufferId: string) => peaksRef.current.get(bufferId) ?? null, []);
  const getBuffer = useCallback((bufferId: string) => buffersRef.current.get(bufferId) ?? null, []);

  const duration = arrangementDuration(tracks);

  // Playhead ticker during playback
  useEffect(() => {
    if (!isPlaying || isRecording) return;
    let raf = 0;
    const tick = () => {
      setPlayhead(getPlayer().currentTime());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, isRecording, getPlayer]);

  // Input level meter while recording
  useEffect(() => {
    if (!isRecording || !recorderRef.current) return;
    const analyser = recorderRef.current.analyser;
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = ((data[i] as number) - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 2.6));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isRecording]);

  const stop = useCallback(() => {
    getPlayer().stop();
    setIsPlaying(false);
    optionsRef.current.onPause?.();
  }, [getPlayer]);

  const play = useCallback(() => {
    const player = getPlayer();
    player.play(tracks, buffersRef.current, playhead, () => {
      setIsPlaying(false);
      optionsRef.current.onPause?.();
    });
    setIsPlaying(true);
    optionsRef.current.onPlay?.(playhead);
  }, [getPlayer, playhead, tracks]);

  const seek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, time);
      getPlayer().seek(clamped);
      setPlayhead(clamped);
      setIsPlaying(false);
      optionsRef.current.onSeek?.(clamped);
    },
    [getPlayer],
  );

  const addTrack = useCallback(() => {
    let created = "";
    commit((current) => {
      const track = makeTrack(current.length);
      created = track.id;
      return [...current, track];
    });
    return created;
  }, [commit]);

  const updateTrack = useCallback(
    (id: string, patch: Partial<Track>) => {
      setTracksState((current) => current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [],
  );

  const removeTrack = useCallback(
    (id: string) => commit((current) => current.filter((t) => t.id !== id)),
    [commit],
  );

  const startRecording = useCallback(
    async (trackId?: string) => {
      const stream = await requestMicStream();
      const handle = await createRecorder(stream);
      recorderRef.current = handle;

      let target = trackId ?? null;
      if (!target) {
        target = addTrack();
      }
      recordTrackRef.current = target;
      recordStartRef.current = playhead;

      handle.recorder.start();
      setIsRecording(true);
      optionsRef.current.onRecordStart?.();

      const started = getAudioContext().currentTime;
      const tick = () => {
        if (!recorderRef.current) return;
        setPlayhead(recordStartRef.current + (getAudioContext().currentTime - started));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Play the existing arrangement underneath the new take (overdub).
      getPlayer().play(tracks, buffersRef.current, recordStartRef.current);
    },
    [addTrack, getPlayer, playhead, tracks],
  );

  const stopRecording = useCallback(async () => {
    const handle = recorderRef.current;
    if (!handle) return;
    const blob = await handle.stop();
    handle.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    setIsRecording(false);
    setLevel(0);
    getPlayer().stop();
    optionsRef.current.onRecordStop?.();

    const buffer = await decodeBlob(blob);
    const bufferId = crypto.randomUUID();
    registerBuffer(bufferId, buffer);

    const trackId = recordTrackRef.current;
    const clip: Clip = {
      id: crypto.randomUUID(),
      bufferId,
      start: recordStartRef.current,
      offset: 0,
      duration: buffer.duration,
    };
    commit((current) =>
      current.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t)),
    );
    setPlayhead(recordStartRef.current + buffer.duration);
    return { bufferId, blob: audioBufferToWav(buffer), duration: buffer.duration };
  }, [commit, getPlayer, registerBuffer]);

  const splitAtPlayhead = useCallback(() => {
    commit((current) =>
      current.map((track) => ({
        ...track,
        clips: track.clips.flatMap((clip) => {
          const end = clip.start + clip.duration;
          if (playhead <= clip.start + 0.02 || playhead >= end - 0.02) return [clip];
          const left: Clip = { ...clip, duration: playhead - clip.start };
          const right: Clip = {
            ...clip,
            id: crypto.randomUUID(),
            start: playhead,
            offset: clip.offset + (playhead - clip.start),
            duration: end - playhead,
          };
          return [left, right];
        }),
      })),
    );
  }, [commit, playhead]);

  const updateClip = useCallback(
    (trackId: string, clipId: string, patch: Partial<Clip>) => {
      commit((current) =>
        current.map((track) =>
          track.id === trackId
            ? {
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id === clipId ? { ...clip, ...patch } : clip,
                ),
              }
            : track,
        ),
      );
    },
    [commit],
  );

  const deleteClip = useCallback(
    (trackId: string, clipId: string) => {
      commit((current) =>
        current.map((track) =>
          track.id === trackId
            ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
            : track,
        ),
      );
      setSelectedClip(null);
    },
    [commit],
  );

  const duplicateClip = useCallback(
    (trackId: string, clipId: string) => {
      commit((current) =>
        current.map((track) => {
          if (track.id !== trackId) return track;
          const clip = track.clips.find((c) => c.id === clipId);
          if (!clip) return track;
          return {
            ...track,
            clips: [
              ...track.clips,
              { ...clip, id: crypto.randomUUID(), start: clip.start + clip.duration },
            ],
          };
        }),
      );
    },
    [commit],
  );

  const mixdown = useCallback(async () => {
    const total = arrangementDuration(tracks);
    if (total <= 0) throw new Error("Nothing to mix yet — record a take first.");
    const rendered = await renderMix(tracks, buffersRef.current, total);
    return { blob: audioBufferToWav(rendered), duration: total };
  }, [tracks]);

  const loadArrangement = useCallback(
    (nextTracks: Track[]) => {
      historyRef.current = { past: [], future: [] };
      setTracksState(nextTracks);
      setPlayhead(0);
    },
    [],
  );

  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    tracks,
    duration,
    playhead,
    isPlaying,
    isRecording,
    level,
    peaksVersion,
    selectedClip,
    setSelectedClip,
    play,
    stop,
    seek,
    addTrack,
    updateTrack,
    removeTrack,
    startRecording,
    stopRecording,
    splitAtPlayhead,
    updateClip,
    deleteClip,
    duplicateClip,
    mixdown,
    undo,
    redo,
    getPeaks,
    getBuffer,
    registerBuffer,
    loadArrangement,
    canUndo: historyRef.current.past.length > 0,
  };
}

export type StudioApi = ReturnType<typeof useStudio>;
