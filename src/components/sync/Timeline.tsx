import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioApi } from "./use-studio";
import type { Clip, Track } from "@/lib/audio/arrangement";

const LANE_HEIGHT = 84;
const HEADER_HEIGHT = 26;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function Timeline({ studio, pxPerSecond }: { studio: StudioApi; pxPerSecond: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [drag, setDrag] = useState<{
    trackId: string;
    clip: Clip;
    grabX: number;
    startX: number;
  } | null>(null);

  const { tracks, playhead, seek, peaksVersion, getPeaks, selectedClip, setSelectedClip } = studio;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const contentWidth = Math.max(width, (studio.duration + 12) * pxPerSecond);
  const height = HEADER_HEIGHT + Math.max(1, tracks.length) * LANE_HEIGHT;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = contentWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${contentWidth}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    const border = read("--border", "#334");
    const muted = read("--muted-foreground", "#889");
    const primary = read("--primary", "#3ee");
    const panel = read("--panel", "#1c2130");

    ctx.clearRect(0, 0, contentWidth, height);

    // Ruler
    ctx.fillStyle = panel;
    ctx.fillRect(0, 0, contentWidth, HEADER_HEIGHT);
    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_HEIGHT + 0.5);
    ctx.lineTo(contentWidth, HEADER_HEIGHT + 0.5);
    ctx.stroke();

    const step = pxPerSecond < 30 ? 5 : 1;
    ctx.font = "10px ui-sans-serif, system-ui";
    for (let s = 0; s * pxPerSecond < contentWidth; s += step) {
      const x = Math.round(s * pxPerSecond) + 0.5;
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(x, HEADER_HEIGHT - 7);
      ctx.lineTo(x, HEADER_HEIGHT);
      ctx.stroke();
      ctx.fillStyle = muted;
      if (s % (step * 5) === 0) {
        ctx.fillText(`${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`, x + 3, 12);
      }
      ctx.strokeStyle = `color-mix(in oklch, ${border} 55%, transparent)`;
      ctx.beginPath();
      ctx.moveTo(x, HEADER_HEIGHT);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    tracks.forEach((track: Track, index: number) => {
      const top = HEADER_HEIGHT + index * LANE_HEIGHT;
      ctx.fillStyle = index % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent";
      ctx.fillRect(0, top, contentWidth, LANE_HEIGHT);
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(0, top + LANE_HEIGHT + 0.5);
      ctx.lineTo(contentWidth, top + LANE_HEIGHT + 0.5);
      ctx.stroke();

      for (const clip of track.clips) {
        const x = clip.start * pxPerSecond;
        const w = Math.max(2, clip.duration * pxPerSecond);
        const y = top + 8;
        const h = LANE_HEIGHT - 16;
        const isSelected = clip.id === selectedClip;

        ctx.fillStyle = `color-mix(in oklch, ${track.color} 22%, ${panel})`;
        ctx.strokeStyle = isSelected ? primary : track.color;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x + 1, y, w - 2, h, 6);
        ctx.fill();
        ctx.stroke();

        const peaks = getPeaks(clip.bufferId);
        if (peaks) {
          const buffer = studio.getBuffer(clip.bufferId);
          const total = buffer?.duration ?? clip.duration;
          const buckets = peaks.length / 2;
          const from = Math.floor((clip.offset / total) * buckets);
          const to = Math.floor(((clip.offset + clip.duration) / total) * buckets);
          const span = Math.max(1, to - from);
          ctx.strokeStyle = track.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let px = 0; px < w - 4; px++) {
            const bucket = from + Math.floor((px / Math.max(1, w - 4)) * span);
            const min = peaks[bucket * 2] ?? 0;
            const max = peaks[bucket * 2 + 1] ?? 0;
            const cx = x + 2 + px + 0.5;
            ctx.moveTo(cx, y + h / 2 - (max * h) / 2.4);
            ctx.lineTo(cx, y + h / 2 - (min * h) / 2.4);
          }
          ctx.stroke();
        }
      }
    });

    // Playhead
    const px = Math.round(playhead * pxPerSecond) + 0.5;
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();
  }, [contentWidth, height, pxPerSecond, tracks, playhead, selectedClip, getPeaks, studio, peaksVersion]);

  useEffect(() => {
    draw();
  }, [draw]);

  const hitTest = (x: number, y: number) => {
    const index = Math.floor((y - HEADER_HEIGHT) / LANE_HEIGHT);
    const track = tracks[index];
    if (!track) return null;
    const time = x / pxPerSecond;
    const clip = track.clips.find((c) => time >= c.start && time <= c.start + c.duration);
    return clip ? { track, clip } : null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (y < HEADER_HEIGHT) {
      seek(Math.max(0, x / pxPerSecond));
      return;
    }
    const hit = hitTest(x, y);
    if (hit) {
      setSelectedClip(hit.clip.id);
      setDrag({ trackId: hit.track.id, clip: hit.clip, grabX: x, startX: hit.clip.start });
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      setSelectedClip(null);
      seek(Math.max(0, x / pxPerSecond));
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const delta = (x - drag.grabX) / pxPerSecond;
    const next = Math.max(0, drag.startX + delta);
    studio.updateClip(drag.trackId, drag.clip.id, { start: next });
  };

  const endDrag = () => setDrag(null);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 text-xs text-muted-foreground">
        <span className="font-mono">{formatTime(playhead)}</span>
        <span>Drag clips to move · click the ruler to scrub</span>
      </div>
      <div ref={wrapperRef} className="overflow-x-auto">
        <canvas
          ref={canvasRef}
          className="block cursor-pointer touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
    </div>
  );
}
