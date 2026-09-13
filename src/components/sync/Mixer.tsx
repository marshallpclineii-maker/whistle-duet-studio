import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Circle } from "lucide-react";
import type { StudioApi } from "./use-studio";
import type { Track, TrackEffects } from "@/lib/audio/arrangement";
import {
  EFFECT_DEFS,
  VOICES,
  defaultEffectParams,
  type EffectId,
  type VoiceId,
} from "@/lib/audio/effects";

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
  const effects: TrackEffects = track.effects;

  const setVoice = (voice: VoiceId) => update({ effects: { ...effects, voice } });

  const toggleEffect = (id: EffectId, on: boolean) => {
    const current = effects.rack[id];
    update({
      effects: {
        ...effects,
        rack: {
          ...effects.rack,
          [id]: { on, params: current?.params ?? defaultEffectParams(id) },
        },
      },
    });
  };

  const setParam = (id: EffectId, key: string, value: number) => {
    const current = effects.rack[id] ?? { on: true, params: defaultEffectParams(id) };
    update({
      effects: {
        ...effects,
        rack: {
          ...effects.rack,
          [id]: { on: current.on, params: { ...current.params, [key]: value } },
        },
      },
    });
  };

  return (
    <div className="panel flex w-60 shrink-0 flex-col gap-3 p-3">
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

      <Fader
        label="Volume"
        value={track.volume}
        min={0}
        max={1.4}
        step={0.01}
        onChange={(v) => update({ volume: v })}
        display={`${Math.round(track.volume * 100)}%`}
      />
      <Fader
        label="Pan"
        value={track.pan}
        min={-1}
        max={1}
        step={0.02}
        onChange={(v) => update({ pan: v })}
        display={
          track.pan === 0
            ? "C"
            : `${track.pan < 0 ? "L" : "R"}${Math.round(Math.abs(track.pan) * 100)}`
        }
      />

      <div className="space-y-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Voice</span>
        <Select value={effects.voice} onValueChange={(v) => setVoice(v as VoiceId)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VOICES.map((voice) => (
              <SelectItem key={voice.id} value={voice.id}>
                {voice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Effects rack
        </span>
        {EFFECT_DEFS.map((def) => {
          const state = effects.rack[def.id];
          const on = state?.on ?? false;
          return (
            <div key={def.id} className="rounded-sm border border-border/70 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{def.label}</span>
                <Switch
                  checked={on}
                  onCheckedChange={(checked) => toggleEffect(def.id, checked)}
                  aria-label={`${def.label} on ${track.name}`}
                />
              </div>
              {on && (
                <div className="mt-2 space-y-2">
                  {def.params.map((param) => {
                    const value = state?.params[param.key] ?? param.def;
                    return (
                      <Fader
                        key={param.key}
                        label={param.label}
                        value={value}
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        onChange={(v) => setParam(def.id, param.key, v)}
                        display={`${Math.round(value * 100) / 100}${param.unit ? ` ${param.unit}` : ""}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

function Fader({
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
