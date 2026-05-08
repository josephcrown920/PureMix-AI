import React from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  group: "voice" | "eq" | "dynamics" | "color" | "space";
}

const PARAMS: ParamDef[] = [
  { key: "noise_gate_db", label: "Noise gate", min: -90, max: 0, step: 1, unit: "dB", group: "voice" },
  { key: "denoise_amount", label: "Denoise", min: 0, max: 1, step: 0.05, group: "voice" },

  { key: "low_shelf_db", label: "Low shelf", min: -12, max: 12, step: 0.5, unit: "dB", group: "eq" },
  { key: "low_shelf_hz", label: "Low Hz", min: 30, max: 500, step: 10, unit: "Hz", group: "eq" },
  { key: "mid_db", label: "Mid", min: -12, max: 12, step: 0.5, unit: "dB", group: "eq" },
  { key: "mid_hz", label: "Mid Hz", min: 200, max: 5000, step: 50, unit: "Hz", group: "eq" },
  { key: "presence_db", label: "Presence", min: -12, max: 12, step: 0.5, unit: "dB", group: "eq" },
  { key: "air_db", label: "Air", min: -12, max: 12, step: 0.5, unit: "dB", group: "eq" },

  { key: "compressor_threshold_db", label: "Comp threshold", min: -40, max: 0, step: 0.5, unit: "dB", group: "dynamics" },
  { key: "compressor_ratio", label: "Comp ratio", min: 1, max: 20, step: 0.1, unit: ":1", group: "dynamics" },
  { key: "compressor_attack_ms", label: "Attack", min: 0.1, max: 200, step: 0.5, unit: "ms", group: "dynamics" },
  { key: "compressor_release_ms", label: "Release", min: 10, max: 2000, step: 10, unit: "ms", group: "dynamics" },
  { key: "transient_attack", label: "Transient attack", min: -1, max: 1, step: 0.05, group: "dynamics" },
  { key: "transient_sustain", label: "Transient sustain", min: -1, max: 1, step: 0.05, group: "dynamics" },

  { key: "saturation_amount", label: "Soundgoodizer", min: 0, max: 1, step: 0.05, group: "color" },
  { key: "stereo_width", label: "Stereo width", min: 0, max: 2, step: 0.05, group: "color" },

  { key: "reverb_amount", label: "Reverb send", min: 0, max: 0.5, step: 0.02, group: "space" },
  { key: "reverb_room_size", label: "Room size", min: 0, max: 1, step: 0.05, group: "space" },
  { key: "limiter_ceiling_db", label: "Limiter ceiling", min: -6, max: 0, step: 0.1, unit: "dB", group: "space" },
];

const GROUP_LABELS: Record<ParamDef["group"], string> = {
  voice: "Voice cleanup",
  eq: "Equalizer",
  dynamics: "Dynamics & transients",
  color: "Color & width (Soundgoodizer)",
  space: "Space & limiter (Fruity)",
};

export interface TotalControlValue {
  enabled: boolean;
  voice_cleanup: boolean;
  params: Record<string, number>;
}

interface Props {
  value: TotalControlValue;
  onChange: (v: TotalControlValue) => void;
}

/**
 * Collapsible "Total Control" panel — exposes every DSP knob.
 * Off by default; preset values are used until the user toggles in.
 */
export function TotalControlPanel({ value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);

  const setParam = (k: string, n: number) => {
    onChange({ ...value, params: { ...value.params, [k]: n } });
  };
  const reset = () => onChange({ ...value, params: {} });

  const groups = Array.from(new Set(PARAMS.map((p) => p.group)));

  return (
    <div className="rounded-md border border-border/50 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors"
        data-testid="btn-toggle-total-control"
      >
        <div>
          <div className="text-sm font-semibold">Total Control</div>
          <div className="text-xs text-muted-foreground">
            Tweak every DSP parameter manually. Off uses the preset defaults.
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border/50 p-4 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={value.enabled}
                onCheckedChange={(c) => onChange({ ...value, enabled: c })}
                data-testid="switch-total-control-enabled"
              />
              <Label className="text-sm">Enable manual overrides</Label>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={reset}
              disabled={Object.keys(value.params).length === 0}
              data-testid="btn-reset-params"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>
          </div>

          <div
            className={`flex items-center gap-3 ${value.enabled ? "" : "opacity-50 pointer-events-none"}`}
          >
            <Switch
              checked={value.voice_cleanup}
              onCheckedChange={(c) => onChange({ ...value, voice_cleanup: c })}
              data-testid="switch-voice-cleanup"
            />
            <Label className="text-sm">Voice cleanup (noise gate)</Label>
          </div>

          <div className={value.enabled ? "" : "opacity-50 pointer-events-none"}>
            {groups.map((g) => (
              <div key={g} className="mb-5 last:mb-0">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  {GROUP_LABELS[g]}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  {PARAMS.filter((p) => p.group === g).map((p) => {
                    const current = value.params[p.key];
                    return (
                      <div key={p.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span>{p.label}</span>
                          <span className="font-mono text-muted-foreground tabular-nums">
                            {current != null
                              ? `${current.toFixed(2)}${p.unit ?? ""}`
                              : "—"}
                          </span>
                        </div>
                        <Slider
                          min={p.min}
                          max={p.max}
                          step={p.step}
                          value={[current ?? (p.min + p.max) / 2]}
                          onValueChange={(v) => setParam(p.key, v[0])}
                          data-testid={`slider-${p.key}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Build the payload to send to the server. Returns null if nothing set. */
export function buildCustomParamsPayload(
  v: TotalControlValue,
): Record<string, number | boolean> | null {
  if (!v.enabled) return null;
  const out: Record<string, number | boolean> = {
    voice_cleanup: v.voice_cleanup,
    ...v.params,
  };
  return Object.keys(out).length > 0 ? out : null;
}
