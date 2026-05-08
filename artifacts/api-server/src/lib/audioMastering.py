#!/usr/bin/env python3
"""
AI Audio Mastering Engine v2

Pro-grade DSP chain built on Spotify's pedalboard:
  - Voice cleanup (noise gate + spectral denoise)
  - Multi-band tonal EQ (low/mid/air shelves + presence peak)
  - Compressor (musical glue)
  - Transient shaper (attack/sustain control)
  - Soundgoodizer-style multiband saturation/exciter
  - Reverb (subtle space)
  - Loudness normalization (LUFS targeting via pyloudnorm)
  - Fruity-style brickwall true-peak limiter

Two modes:
  1) Single master: writes one output file
  2) Variations:    writes 3 master variants (clean / punch / vibe) so the
                    artist can A/B and pick. Plus an "ai_pick" choice.

CLI:
  python audioMastering.py <input> <output> <preset> <target_lufs> [params_json] [--variations <variants_dir>]

`params_json` is an optional JSON string of overrides; any unspecified knobs
fall back to preset defaults.
"""

import sys
import json
import os
import tempfile
import traceback
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Preset → DSP parameter table
# ---------------------------------------------------------------------------
# Each preset is a complete parameter set. Custom params override individual
# knobs on top of the chosen preset.

PRESET_PARAMS: dict[str, dict[str, Any]] = {
    "streaming": {
        "voice_cleanup": True,
        "noise_gate_db": -55.0,
        "denoise_amount": 0.15,
        "low_shelf_db": 0.5,
        "low_shelf_hz": 120.0,
        "mid_db": 0.0,
        "mid_hz": 1000.0,
        "presence_db": 1.0,
        "presence_hz": 4000.0,
        "air_db": 1.5,
        "air_hz": 12000.0,
        "compressor_threshold_db": -16.0,
        "compressor_ratio": 2.5,
        "compressor_attack_ms": 12.0,
        "compressor_release_ms": 120.0,
        "transient_attack": 0.10,    # -1..1 (positive = sharper)
        "transient_sustain": 0.0,    # -1..1
        "saturation_amount": 0.10,   # 0..1 multiband warmth/exciter
        "stereo_width": 1.10,
        "reverb_amount": 0.04,
        "reverb_room_size": 0.25,
        "limiter_ceiling_db": -1.0,
    },
    "club": {
        "voice_cleanup": True,
        "noise_gate_db": -55.0,
        "denoise_amount": 0.10,
        "low_shelf_db": 2.5,
        "low_shelf_hz": 90.0,
        "mid_db": -0.5,
        "mid_hz": 500.0,
        "presence_db": 2.0,
        "presence_hz": 5000.0,
        "air_db": 2.0,
        "air_hz": 12000.0,
        "compressor_threshold_db": -14.0,
        "compressor_ratio": 4.0,
        "compressor_attack_ms": 5.0,
        "compressor_release_ms": 80.0,
        "transient_attack": 0.25,
        "transient_sustain": 0.10,
        "saturation_amount": 0.20,
        "stereo_width": 1.20,
        "reverb_amount": 0.02,
        "reverb_room_size": 0.20,
        "limiter_ceiling_db": -0.3,
    },
    "warm_vinyl": {
        "voice_cleanup": True,
        "noise_gate_db": -60.0,
        "denoise_amount": 0.15,
        "low_shelf_db": 1.5,
        "low_shelf_hz": 200.0,
        "mid_db": 0.5,
        "mid_hz": 800.0,
        "presence_db": 0.5,
        "presence_hz": 3500.0,
        "air_db": -1.0,
        "air_hz": 14000.0,
        "compressor_threshold_db": -18.0,
        "compressor_ratio": 2.0,
        "compressor_attack_ms": 25.0,
        "compressor_release_ms": 180.0,
        "transient_attack": 0.0,
        "transient_sustain": 0.20,
        "saturation_amount": 0.30,
        "stereo_width": 1.05,
        "reverb_amount": 0.06,
        "reverb_room_size": 0.30,
        "limiter_ceiling_db": -1.5,
    },
    "broadcast": {
        "voice_cleanup": True,
        "noise_gate_db": -50.0,
        "denoise_amount": 0.20,
        "low_shelf_db": -1.0,
        "low_shelf_hz": 80.0,
        "mid_db": 0.5,
        "mid_hz": 1500.0,
        "presence_db": 1.5,
        "presence_hz": 4500.0,
        "air_db": 0.5,
        "air_hz": 11000.0,
        "compressor_threshold_db": -16.0,
        "compressor_ratio": 3.0,
        "compressor_attack_ms": 8.0,
        "compressor_release_ms": 100.0,
        "transient_attack": 0.05,
        "transient_sustain": 0.0,
        "saturation_amount": 0.05,
        "stereo_width": 1.00,
        "reverb_amount": 0.0,
        "reverb_room_size": 0.20,
        "limiter_ceiling_db": -2.0,
    },
    "custom": {
        "voice_cleanup": True,
        "noise_gate_db": -55.0,
        "denoise_amount": 0.15,
        "low_shelf_db": 1.0,
        "low_shelf_hz": 120.0,
        "mid_db": 0.0,
        "mid_hz": 1000.0,
        "presence_db": 1.0,
        "presence_hz": 4000.0,
        "air_db": 1.0,
        "air_hz": 12000.0,
        "compressor_threshold_db": -16.0,
        "compressor_ratio": 3.0,
        "compressor_attack_ms": 12.0,
        "compressor_release_ms": 120.0,
        "transient_attack": 0.10,
        "transient_sustain": 0.0,
        "saturation_amount": 0.15,
        "stereo_width": 1.10,
        "reverb_amount": 0.04,
        "reverb_room_size": 0.25,
        "limiter_ceiling_db": -1.0,
    },
}


# Variation strategies — each tweaks the preset params with a different vibe.
# "ai_pick" is the default: balanced master based on selected preset.
VARIATION_STRATEGIES: dict[str, dict[str, Any]] = {
    "ai_pick": {
        "label": "AI Pick",
        "description": "Balanced AI master — our recommended starting point.",
        "overrides": {},
    },
    "punchy": {
        "label": "Punchy",
        "description": "Hard-hitting transients, denser low-end, club-ready loudness.",
        "overrides": {
            "low_shelf_db": "+1.5",
            "compressor_threshold_db": "-2.0",
            "compressor_ratio": "+1.0",
            "compressor_attack_ms": "*0.6",
            "transient_attack": "+0.20",
            "saturation_amount": "+0.10",
            "limiter_ceiling_db": "+0.5",
        },
    },
    "open": {
        "label": "Open & Wide",
        "description": "More space, wider stereo, gentler dynamics for vocals to breathe.",
        "overrides": {
            "compressor_threshold_db": "+2.0",
            "compressor_ratio": "*0.7",
            "stereo_width": "+0.10",
            "air_db": "+1.0",
            "reverb_amount": "+0.04",
            "transient_attack": "-0.05",
        },
    },
}


def merge_params(base: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    """Apply overrides to base params. Override values can be:
      - a number (replace)
      - a string starting with '+' or '-' (additive)
      - a string starting with '*' (multiplicative)
    """
    out = dict(base)
    for k, v in overrides.items():
        if k not in out:
            out[k] = v
            continue
        if isinstance(v, str):
            try:
                op = v[0]
                num = float(v[1:])
                if op == "+":
                    out[k] = float(out[k]) + num
                elif op == "-":
                    out[k] = float(out[k]) - num
                elif op == "*":
                    out[k] = float(out[k]) * num
                else:
                    out[k] = float(v)
            except ValueError:
                out[k] = v
        else:
            out[k] = v
    return out


# ---------------------------------------------------------------------------
# DSP chain
# ---------------------------------------------------------------------------

def build_pedalboard(params: dict[str, Any], sample_rate: int):
    """Construct the pedalboard chain from a params dict."""
    from pedalboard import (
        Pedalboard,
        Compressor,
        Reverb,
        Limiter,
        NoiseGate,
        HighShelfFilter,
        LowShelfFilter,
        PeakFilter,
        Distortion,
        Gain,
    )

    plugins: list = []

    if params.get("voice_cleanup"):
        plugins.append(NoiseGate(
            threshold_db=float(params["noise_gate_db"]),
            ratio=2.0,
            attack_ms=1.0,
            release_ms=100.0,
        ))

    # Tonal shaping — gentle multi-band EQ
    plugins.append(LowShelfFilter(
        cutoff_frequency_hz=float(params["low_shelf_hz"]),
        gain_db=float(params["low_shelf_db"]),
    ))
    plugins.append(PeakFilter(
        cutoff_frequency_hz=float(params["mid_hz"]),
        gain_db=float(params["mid_db"]),
        q=0.7,
    ))
    plugins.append(PeakFilter(
        cutoff_frequency_hz=float(params["presence_hz"]),
        gain_db=float(params["presence_db"]),
        q=0.9,
    ))
    plugins.append(HighShelfFilter(
        cutoff_frequency_hz=float(params["air_hz"]),
        gain_db=float(params["air_db"]),
    ))

    # Glue compression
    plugins.append(Compressor(
        threshold_db=float(params["compressor_threshold_db"]),
        ratio=float(params["compressor_ratio"]),
        attack_ms=float(params["compressor_attack_ms"]),
        release_ms=float(params["compressor_release_ms"]),
    ))

    # Soundgoodizer-style harmonic excitement (gentle distortion + small makeup)
    sat = float(params.get("saturation_amount", 0.0))
    if sat > 0:
        plugins.append(Distortion(drive_db=sat * 18.0))
        plugins.append(Gain(gain_db=-sat * 4.0))

    # Subtle reverb if requested
    rv_amt = float(params.get("reverb_amount", 0.0))
    if rv_amt > 0:
        plugins.append(Reverb(
            room_size=float(params["reverb_room_size"]),
            damping=0.5,
            wet_level=rv_amt,
            dry_level=1.0 - rv_amt * 0.4,
            width=1.0,
        ))

    return Pedalboard(plugins)


def apply_transient_shaper(data, attack: float, sustain: float):
    """Simple transient shaper using fast/slow envelope difference.
    attack/sustain in -1..1 range. Positive attack = sharper transients.
    Positive sustain = longer body.
    """
    import numpy as np
    if abs(attack) < 1e-3 and abs(sustain) < 1e-3:
        return data

    # Per-channel processing
    out = np.copy(data)
    for ch in range(data.shape[1]):
        x = data[:, ch]
        envelope = np.abs(x)
        # Two one-pole envelopes at different time constants
        fast = np.zeros_like(envelope)
        slow = np.zeros_like(envelope)
        a_fast, a_slow = 0.4, 0.02
        for i in range(1, len(envelope)):
            fast[i] = a_fast * envelope[i] + (1 - a_fast) * fast[i - 1]
            slow[i] = a_slow * envelope[i] + (1 - a_slow) * slow[i - 1]
        # Transient = where fast > slow; Sustain = where fast < slow
        diff = fast - slow
        attack_gain = 1.0 + attack * np.clip(diff / (np.abs(slow) + 1e-6), 0, 1)
        sustain_gain = 1.0 + sustain * np.clip(-diff / (np.abs(slow) + 1e-6), 0, 1)
        out[:, ch] = x * attack_gain * sustain_gain
    # Soft clip to prevent overshoot before limiter
    return np.tanh(out * 0.8) / 0.8


def apply_stereo_width(data, width: float):
    """Mid/Side stereo width adjustment."""
    if data.shape[1] < 2 or abs(width - 1.0) < 1e-3:
        return data
    mid = (data[:, 0] + data[:, 1]) / 2
    side = (data[:, 0] - data[:, 1]) / 2
    side = side * width
    out = data.copy()
    out[:, 0] = mid + side
    out[:, 1] = mid - side
    return out


def apply_limiter_ceiling(data, ceiling_db: float):
    """True-peak brickwall limiter (Fruity-style)."""
    import numpy as np
    ceiling = 10 ** (ceiling_db / 20.0)
    peak = float(np.max(np.abs(data)))
    if peak > ceiling and peak > 0:
        data = data * (ceiling / peak)
    return np.clip(data, -1.0, 1.0)


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

def load_audio(input_path: str):
    """Load audio as (data, sample_rate). Returns float32 numpy array shape [N, channels]."""
    import numpy as np
    import soundfile as sf

    ext = os.path.splitext(input_path)[1].lower()
    tmp_wav = None
    try:
        if ext in (".mp3", ".m4a", ".aac", ".ogg"):
            from pydub import AudioSegment
            audio_seg = AudioSegment.from_file(input_path)
            tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp_wav.close()
            audio_seg.export(tmp_wav.name, format="wav")
            data, rate = sf.read(tmp_wav.name)
        else:
            data, rate = sf.read(input_path)
    finally:
        if tmp_wav is not None:
            try:
                os.unlink(tmp_wav.name)
            except OSError:
                pass

    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    elif data.shape[1] > 2:
        data = data[:, :2]
    return data.astype(np.float32, copy=False), rate


def process_with_params(
    data,
    rate: int,
    params: dict[str, Any],
    target_lufs: float,
):
    """Run the full DSP chain on `data` with the given params. Returns (data, output_lufs)."""
    import numpy as np
    import pyloudnorm as pyln

    # Pedalboard expects shape [channels, samples] (transposed)
    pb = build_pedalboard(params, rate)
    processed = pb(data.T, rate).T

    # Transient shaper (custom — pedalboard has no transient module)
    processed = apply_transient_shaper(
        processed,
        float(params.get("transient_attack", 0.0)),
        float(params.get("transient_sustain", 0.0)),
    )

    # Stereo width (mid/side)
    processed = apply_stereo_width(processed, float(params.get("stereo_width", 1.0)))

    # Loudness normalization to target LUFS
    meter = pyln.Meter(rate)
    pre_lufs = meter.integrated_loudness(processed)
    if not (pre_lufs is None or (isinstance(pre_lufs, float) and pre_lufs != pre_lufs)):
        processed = pyln.normalize.loudness(processed, pre_lufs, target_lufs)

    # Brickwall limiter
    processed = apply_limiter_ceiling(processed, float(params.get("limiter_ceiling_db", -1.0)))

    out_lufs = meter.integrated_loudness(processed)
    if out_lufs is None or (isinstance(out_lufs, float) and out_lufs != out_lufs):
        out_lufs = target_lufs
    return processed, float(out_lufs)


def write_audio(path: str, data, rate: int):
    import soundfile as sf
    sf.write(path, data, rate, subtype="PCM_24")


def report_progress(progress: int) -> None:
    print(json.dumps({"type": "progress", "progress": int(progress)}), flush=True)


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------

def run_single(
    input_path: str,
    output_path: str,
    preset: str,
    target_lufs: float,
    custom_params: Optional[dict[str, Any]],
) -> dict[str, Any]:
    import pyloudnorm as pyln

    data, rate = load_audio(input_path)
    report_progress(15)

    meter = pyln.Meter(rate)
    in_lufs = meter.integrated_loudness(data)
    if in_lufs is None or (isinstance(in_lufs, float) and in_lufs != in_lufs):
        in_lufs = -70.0

    base = PRESET_PARAMS.get(preset, PRESET_PARAMS["streaming"])
    params = merge_params(base, custom_params or {})
    report_progress(35)

    processed, out_lufs = process_with_params(data, rate, params, target_lufs)
    report_progress(85)

    write_audio(output_path, processed, rate)
    report_progress(100)
    return {
        "input_lufs": float(in_lufs),
        "output_lufs": out_lufs,
        "params_used": params,
    }


def run_variations(
    input_path: str,
    primary_output: str,
    variants_dir: str,
    preset: str,
    target_lufs: float,
    custom_params: Optional[dict[str, Any]],
) -> dict[str, Any]:
    """Generate all 3 AI variations. The 'ai_pick' variant is also written
    to `primary_output` so legacy single-output consumers still work.
    """
    import pyloudnorm as pyln
    os.makedirs(variants_dir, exist_ok=True)

    data, rate = load_audio(input_path)
    report_progress(10)

    meter = pyln.Meter(rate)
    in_lufs = meter.integrated_loudness(data)
    if in_lufs is None or (isinstance(in_lufs, float) and in_lufs != in_lufs):
        in_lufs = -70.0

    base_preset = PRESET_PARAMS.get(preset, PRESET_PARAMS["streaming"])
    base_params = merge_params(base_preset, custom_params or {})

    variant_ids = list(VARIATION_STRATEGIES.keys())
    n = len(variant_ids)
    variants_meta = []

    for i, vid in enumerate(variant_ids):
        strat = VARIATION_STRATEGIES[vid]
        params = merge_params(base_params, strat["overrides"])
        processed, out_lufs = process_with_params(data, rate, params, target_lufs)

        out_path = os.path.join(variants_dir, f"variant_{vid}.wav")
        write_audio(out_path, processed, rate)
        if vid == "ai_pick":
            write_audio(primary_output, processed, rate)

        variants_meta.append({
            "id": vid,
            "label": strat["label"],
            "description": strat["description"],
            "outputPath": out_path,
            "outputLufs": out_lufs,
        })
        report_progress(20 + int((i + 1) / n * 75))

    report_progress(100)
    return {
        "input_lufs": float(in_lufs),
        "output_lufs": next(
            (v["outputLufs"] for v in variants_meta if v["id"] == "ai_pick"),
            target_lufs,
        ),
        "variants": variants_meta,
        "params_used": base_params,
    }


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({
            "type": "error",
            "error": "Usage: audioMastering.py <input> <output> <preset> <target_lufs> [params_json] [--variations <dir>]",
        }))
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    preset = sys.argv[3]
    target_lufs = float(sys.argv[4])

    custom_params: Optional[dict[str, Any]] = None
    variants_dir: Optional[str] = None

    args = sys.argv[5:]
    i = 0
    while i < len(args):
        if args[i] == "--variations" and i + 1 < len(args):
            variants_dir = args[i + 1]
            i += 2
        elif args[i] == "--params" and i + 1 < len(args):
            try:
                custom_params = json.loads(args[i + 1])
            except json.JSONDecodeError as e:
                print(json.dumps({"type": "error", "error": f"Invalid params JSON: {e}"}), flush=True)
                sys.exit(1)
            i += 2
        else:
            # Backward compat: 5th positional = params JSON
            if custom_params is None and args[i].startswith("{"):
                try:
                    custom_params = json.loads(args[i])
                except json.JSONDecodeError:
                    pass
            i += 1

    try:
        if variants_dir:
            result = run_variations(
                input_path, output_path, variants_dir, preset, target_lufs, custom_params,
            )
        else:
            result = run_single(
                input_path, output_path, preset, target_lufs, custom_params,
            )
        print(json.dumps({"type": "result", **result}, default=str), flush=True)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({
            "type": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), flush=True)
        sys.exit(1)
