import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Vertical VU-style level meter. `level` is 0..1 linear. */
export function Meter({
  level,
  vertical = true,
  className,
}: {
  level: number;
  vertical?: boolean;
  className?: string;
}) {
  const segments = 16;
  const active = Math.round(Math.min(1, Math.max(0, level)) * segments);
  const items = Array.from({ length: segments }, (_, i) => (vertical ? segments - 1 - i : i));
  return (
    <div
      className={cn(
        "flex gap-[2px] rounded-sm bg-rail p-[3px]",
        vertical ? "h-full w-3 flex-col" : "h-3 w-full flex-row",
        className,
      )}
      aria-hidden
    >
      {items.map((idx) => {
        const on = idx < active;
        const tone =
          idx > segments * 0.86
            ? "bg-meter-high"
            : idx > segments * 0.66
              ? "bg-meter-mid"
              : "bg-meter-low";
        return (
          <div
            key={idx}
            className={cn("flex-1 rounded-[1px]", on ? tone : "bg-foreground/8")}
            style={on ? { boxShadow: "0 0 6px -1px currentColor" } : undefined}
          />
        );
      })}
    </div>
  );
}

/** Vertical channel fader. */
export function Fader({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center gap-2">
      <input
        aria-label={label ?? "Level"}
        type="range"
        min={0}
        max={1.5}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-32 w-8 cursor-pointer appearance-none bg-transparent accent-primary"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
      />
      <span className="readout text-[10px] text-muted-foreground">
        {value === 0 ? "-inf" : `${(20 * Math.log10(value)).toFixed(1)}`}
      </span>
    </div>
  );
}

/** Canvas waveform from precomputed peaks (0..1). */
export function Waveform({
  peaks,
  progress = 0,
  height = 48,
  className,
}: {
  peaks: number[];
  progress?: number;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, height);
    const styles = getComputedStyle(canvas);
    const wave = styles.getPropertyValue("--wave").trim() || "#e0a33a";
    const dim = styles.getPropertyValue("--muted-foreground").trim() || "#888";
    const n = peaks.length || 1;
    const bw = w / n;
    for (let i = 0; i < n; i++) {
      const p = Math.max(0.02, peaks[i] ?? 0);
      const h = p * (height - 4);
      ctx.fillStyle = i / n <= progress ? `oklch(${wave})` : `oklch(${dim})`;
      ctx.globalAlpha = i / n <= progress ? 1 : 0.5;
      ctx.fillRect(i * bw, (height - h) / 2, Math.max(1, bw - 1), h);
    }
  }, [peaks, progress, height]);

  return <canvas ref={ref} className={cn("w-full", className)} style={{ height }} />;
}
