import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  size?: number;
  onChange: (v: number) => void;
}

export function Knob({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit,
  size = 44,
  onChange,
}: KnobProps) {
  const dragging = useRef<{ y: number; start: number } | null>(null);

  const clamp = useCallback(
    (v: number) => {
      const snapped = Math.round(v / step) * step;
      return Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
    },
    [min, max, step],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragging.current;
      if (!d) return;
      const delta = (d.y - e.clientY) / 140;
      onChange(clamp(d.start + delta * (max - min)));
    };
    const up = () => {
      dragging.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [clamp, max, min, onChange]);

  const pct = (value - min) / (max - min || 1);
  const angle = -135 + pct * 270;

  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        className="relative cursor-ns-resize touch-none rounded-full border border-border bg-panel-raised brushed shadow-knob"
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragging.current = { y: e.clientY, start: value };
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(clamp(value + step));
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(clamp(value - step));
        }}
        onDoubleClick={() => onChange(clamp((min + max) / 2))}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-bottom rounded-full bg-primary"
          style={{
            width: 2,
            height: size * 0.34,
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            transformOrigin: "50% 100%",
            marginTop: 1,
          }}
        />
        <div className="absolute inset-[6px] rounded-full border border-border/60" />
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("readout text-[10px] text-foreground/80")}>
        {Math.abs(value) >= 100 ? Math.round(value) : value.toFixed(2).replace(/\.?0+$/, "")}
        {unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}
