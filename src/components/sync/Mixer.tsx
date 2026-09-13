import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Circle } from "lucide-react";
import type { StudioApi } from "./use-studio";
import type { Track } from "@/lib/audio/arrangement";

export function Mixer({ studio }: { studio: StudioApi }) {
  if (studio.tracks.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No tracks yet. Hit record to lay down your first take.
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto p-3">
      {studio.tracks.map((track) => (
        <ChannelStrip key={track.id} track={track} studio={studio} />
      ))}
    </div>
  );
}

function ChannelStrip({ track, studio }: { track: Track; studio: StudioApi }) {
  const update = (patch: Partial<Track>) => studio.updateTrack(track.id, patch);

  return (
    <div className="panel flex w-52 shrink-0 flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: track.color }} />
        <Input
          value={track.name}
          onChange={(event) => update({ name: event.target.value })}
          className="h-7 border-transparent bg-transparent px-1 text-sm font-medium"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={track.muted ? "destructive" : "secondary"}
          className="h-7 flex-1 text-xs"
          onClick={() => update({ muted: !track.muted })}
        >
          Mute
        </Button>
        <Button
          size="sm"
          variant={track.solo ? "default" : "secondary"}
          className="h-7 flex-1 text-xs"
          onClick={() => update({ solo: !track.solo })}
        >
          Solo
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 w-7 p-0"
          aria-label={`Arm ${track.name}`}
          onClick={() => void studio.startRecording(track.id)}
          disabled={studio.isRecording}
        >
          <Circle className="h-3 w-3 fill-destructive text-destructive" />
        </Button>
      </div>

      <Knob
        label="Volume"
        value={track.volume}
        min={0}
        max={1.4}
        step={0.01}
        onChange={(v) => update({ volume: v })}
        display={`${Math.round(track.volume * 100)}%`}
      />
      <Knob
        label="Pan"
        value={track.pan}
        min={-1}
        max={1}
        step={0.02}
        onChange={(v) => update({ pan: v })}
        display={track.pan === 0 ? "C" : `${track.pan < 0 ? "L" : "R"}${Math.round(Math.abs(track.pan) * 100)}`}
      />
      <Knob
        label="Reverb"
        value={track.effects.reverb}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ effects: { ...track.effects, reverb: v } })}
        display={`${Math.round(track.effects.reverb * 100)}%`}
      />
      <Knob
        label="Delay"
        value={track.effects.delay}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => update({ effects: { ...track.effects, delay: v } })}
        display={`${Math.round(track.effects.delay * 100)}%`}
      />

      <div className="space-y-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Filter</span>
        <Select
          value={track.effects.filterType}
          onValueChange={(value) =>
            update({
              effects: { ...track.effects, filterType: value as Track["effects"]["filterType"] },
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="lowpass">Low pass</SelectItem>
            <SelectItem value="highpass">High pass</SelectItem>
          </SelectContent>
        </Select>
        {track.effects.filterType !== "off" && (
          <Knob
            label="Cutoff"
            value={track.effects.filterFreq}
            min={80}
            max={12000}
            step={10}
            onChange={(v) => update({ effects: { ...track.effects, filterFreq: v } })}
            display={`${Math.round(track.effects.filterFreq)} Hz`}
          />
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 justify-start px-1 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => studio.removeTrack(track.id)}
      >
        <Trash2 className="mr-1 h-3 w-3" /> Delete track
      </Button>
    </div>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground/80">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next ?? value)}
      />
    </div>
  );
}
