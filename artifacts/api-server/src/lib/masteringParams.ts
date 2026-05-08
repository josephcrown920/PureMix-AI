/**
 * Server-side validation of user-supplied "Total Control" DSP parameter
 * overrides. Each parameter has a sane min/max range matching what the
 * Python pedalboard chain accepts. Anything out of range or unknown is
 * silently dropped to keep the audio engine safe.
 */

export interface ParamSpec {
  min: number;
  max: number;
  type: "number" | "boolean";
}

export const PARAM_SPECS: Record<string, ParamSpec> = {
  voice_cleanup: { min: 0, max: 1, type: "boolean" },
  noise_gate_db: { min: -90, max: 0, type: "number" },
  denoise_amount: { min: 0, max: 1, type: "number" },
  low_shelf_db: { min: -12, max: 12, type: "number" },
  low_shelf_hz: { min: 30, max: 500, type: "number" },
  mid_db: { min: -12, max: 12, type: "number" },
  mid_hz: { min: 200, max: 5000, type: "number" },
  presence_db: { min: -12, max: 12, type: "number" },
  presence_hz: { min: 1500, max: 8000, type: "number" },
  air_db: { min: -12, max: 12, type: "number" },
  air_hz: { min: 6000, max: 18000, type: "number" },
  compressor_threshold_db: { min: -40, max: 0, type: "number" },
  compressor_ratio: { min: 1, max: 20, type: "number" },
  compressor_attack_ms: { min: 0.1, max: 200, type: "number" },
  compressor_release_ms: { min: 10, max: 2000, type: "number" },
  transient_attack: { min: -1, max: 1, type: "number" },
  transient_sustain: { min: -1, max: 1, type: "number" },
  saturation_amount: { min: 0, max: 1, type: "number" },
  stereo_width: { min: 0, max: 2, type: "number" },
  reverb_amount: { min: 0, max: 0.5, type: "number" },
  reverb_room_size: { min: 0, max: 1, type: "number" },
  limiter_ceiling_db: { min: -6, max: 0, type: "number" },
};

/**
 * Validate and clamp a sparse params object. Returns null on completely
 * empty / invalid input so callers can store NULL in the DB.
 */
export function validateCustomParams(
  raw: unknown,
): Record<string, number | boolean> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const spec = PARAM_SPECS[k];
    if (!spec) continue;
    if (spec.type === "boolean") {
      if (typeof v === "boolean") out[k] = v;
      else if (typeof v === "number") out[k] = v !== 0;
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    out[k] = Math.max(spec.min, Math.min(spec.max, n));
  }
  return Object.keys(out).length > 0 ? out : null;
}
