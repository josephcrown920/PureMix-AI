#!/usr/bin/env python3
"""
AI Audio Mastering Engine v3 — 3-Stage Pipeline

Stage 1 — Denoise & Compress
  Noise gate → spectral denoising → glue compression
  Goal: clean up artifacts and tame the dynamic range before shaping tone.

Stage 2 — Trim & Limit
  Silence trimming → rough LUFS normalization → soft ceiling limiter
  Goal: remove dead air and bring gain to a workable level before final EQ.

Stage 3 — Transient Enhancement & Master
  Tonal EQ → transient shaper → stereo width → saturation → reverb →
  final LUFS normalization → brickwall true-peak limiter
  Goal: shape the character, then lock in the final loudness and ceiling.

Two modes:
  1) Single master: writes one output file
  2) Variations:    writes 3 master variants (ai_pick / punchy / open) for A/B.

CLI:
  python audioMastering.py <input> <output> <preset> <target_lufs>
    [--params <json>] [--analysis <json>] [--variations <dir>]
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
        "transient_attack": 0.10,
        "transient_sustain": 0.0,
        "saturation_amount": 0.10,
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


# ---------------------------------------------------------------------------
# Parameter helpers
# ---------------------------------------------------------------------------

def merge_params(base: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
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


def adapt_params_to_analysis(
    params: dict[str, Any], analysis: dict[str, Any], target_lufs: float
) -> dict[str, Any]:
    """Adjust DSP parameters based on measured audio characteristics."""
    p = dict(params)

    low_ratio = analysis.get("low_energy_ratio", 0.3)
    lra = analysis.get("loudness_range", 8.0)
    stereo_width = analysis.get("stereo_width", 0.5)
    crest_factor = analysis.get("crest_factor_db", 12.0)
    integrated = analysis.get("integrated_lufs", -18.0)
    spectral_centroid = analysis.get("spectral_centroid_hz", 2000.0)

    # Low-end
    if low_ratio > 0.45:
        p["low_shelf_db"] = max(float(p.get("low_shelf_db", 1.0)) - 2.0, -3.0)
    elif low_ratio < 0.18:
        p["low_shelf_db"] = min(float(p.get("low_shelf_db", 1.0)) + 1.5, 5.0)

    # Dynamics
    if lra > 12.0:
        p["compressor_ratio"] = min(float(p.get("compressor_ratio", 2.5)) * 1.35, 8.0)
        p["compressor_threshold_db"] = max(float(p.get("compressor_threshold_db", -16)) - 3.0, -32.0)
    elif lra > 8.0:
        p["compressor_ratio"] = min(float(p.get("compressor_ratio", 2.5)) * 1.15, 6.0)
    elif lra < 3.0:
        p["compressor_ratio"] = max(float(p.get("compressor_ratio", 2.5)) * 0.65, 1.3)
        p["compressor_threshold_db"] = min(float(p.get("compressor_threshold_db", -16)) + 4.0, -6.0)

    # Transients
    if crest_factor > 16.0:
        p["transient_attack"] = max(float(p.get("transient_attack", 0.1)) - 0.1, -0.2)
    elif crest_factor < 8.0:
        p["transient_attack"] = min(float(p.get("transient_attack", 0.1)) + 0.15, 0.5)

    # Stereo
    if stereo_width < 0.12:
        p["stereo_width"] = min(float(p.get("stereo_width", 1.1)) * 1.2, 1.4)
    elif stereo_width > 0.75:
        p["stereo_width"] = max(float(p.get("stereo_width", 1.1)) * 0.9, 0.95)

    # Brightness
    if spectral_centroid < 1200.0:
        p["air_db"] = min(float(p.get("air_db", 1.5)) + 1.5, 5.0)
    elif spectral_centroid > 4000.0:
        p["air_db"] = max(float(p.get("air_db", 1.5)) - 1.0, -1.0)

    # Headroom
    if abs(integrated - target_lufs) < 2.0:
        p["saturation_amount"] = max(float(p.get("saturation_amount", 0.1)) * 0.6, 0.03)
        p["compressor_ratio"] = max(float(p.get("compressor_ratio", 2.5)) * 0.8, 1.3)

    return p


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

def load_audio(input_path: str):
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


def write_audio(path: str, data, rate: int):
    import soundfile as sf
    sf.write(path, data, rate, subtype="PCM_24")


def report_progress(progress: int) -> None:
    print(json.dumps({"type": "progress", "progress": int(progress)}), flush=True)


# ---------------------------------------------------------------------------
# Stage helpers (shared between 3-stage pipeline)
# ---------------------------------------------------------------------------

def stage1_denoise_compress(data, rate: int, params: dict[str, Any]):
    """
    Stage 1 — Denoise & Compress
    Noise gate removes floor noise, then glue compression tames dynamics.
    This runs first so the compressor works on clean material.
    """
    from pedalboard import Pedalboard, NoiseGate, Compressor

    plugins = []

    if params.get("voice_cleanup"):
        plugins.append(NoiseGate(
            threshold_db=float(params["noise_gate_db"]),
            ratio=2.0,
            attack_ms=1.0,
            release_ms=100.0,
        ))

    plugins.append(Compressor(
        threshold_db=float(params["compressor_threshold_db"]),
        ratio=float(params["compressor_ratio"]),
        attack_ms=float(params["compressor_attack_ms"]),
        release_ms=float(params["compressor_release_ms"]),
    ))

    pb = Pedalboard(plugins)
    return pb(data.T, rate).T


def stage2_trim_limit(data, rate: int, params: dict[str, Any], target_lufs: float):
    """
    Stage 2 — Trim & Limit
    1. Trim leading and trailing silence so the master starts/ends cleanly.
    2. Rough-normalize to target_lufs + 2 dB headroom so Stage 3 EQ/sat
       has consistent input gain.
    3. Soft ceiling at -3 dBFS to tame any rogue peaks before final mastering.
    """
    import numpy as np
    import pyloudnorm as pyln

    # --- Silence trimming ---
    gate_db = float(params.get("noise_gate_db", -55.0))
    gate_lin = 10 ** (gate_db / 20.0)

    mono = np.abs(data).max(axis=1)
    above = np.where(mono > gate_lin)[0]
    if len(above) >= 2:
        fade = int(rate * 0.01)  # 10 ms fade margin
        start = max(0, above[0] - fade)
        end = min(len(data), above[-1] + fade)
        data = data[start:end]

    # --- Rough LUFS normalize (with 2 dB headroom for Stage 3) ---
    meter = pyln.Meter(rate)
    lufs = meter.integrated_loudness(data)
    if lufs is not None and not (isinstance(lufs, float) and lufs != lufs) and lufs > -70:
        working_target = target_lufs + 2.0  # leave headroom for Stage 3 EQ/sat
        data = pyln.normalize.loudness(data, lufs, working_target)

    # --- Soft ceiling at -3 dBFS ---
    soft_ceil = 10 ** (-3.0 / 20.0)
    peak = float(np.max(np.abs(data)))
    if peak > soft_ceil and peak > 0:
        data = data * (soft_ceil / peak)

    return data


def stage3_enhance_master(data, rate: int, params: dict[str, Any], target_lufs: float):
    """
    Stage 3 — Transient Enhancement & Master
    1. Tonal EQ (low shelf + mid peak + presence + air shelf)
    2. Transient shaping (attack / sustain envelope)
    3. Mid/Side stereo widening
    4. Harmonic saturation (multiband exciter)
    5. Subtle reverb for depth
    6. Final LUFS normalization to target
    7. Brickwall true-peak limiter
    """
    import numpy as np
    import pyloudnorm as pyln
    from pedalboard import (
        Pedalboard,
        HighShelfFilter,
        LowShelfFilter,
        PeakFilter,
        Distortion,
        Gain,
        Reverb,
    )

    # --- Tonal EQ ---
    eq_plugins = [
        LowShelfFilter(
            cutoff_frequency_hz=float(params["low_shelf_hz"]),
            gain_db=float(params["low_shelf_db"]),
        ),
        PeakFilter(
            cutoff_frequency_hz=float(params["mid_hz"]),
            gain_db=float(params["mid_db"]),
            q=0.7,
        ),
        PeakFilter(
            cutoff_frequency_hz=float(params["presence_hz"]),
            gain_db=float(params["presence_db"]),
            q=0.9,
        ),
        HighShelfFilter(
            cutoff_frequency_hz=float(params["air_hz"]),
            gain_db=float(params["air_db"]),
        ),
    ]

    sat = float(params.get("saturation_amount", 0.0))
    if sat > 0:
        eq_plugins.append(Distortion(drive_db=sat * 18.0))
        eq_plugins.append(Gain(gain_db=-sat * 4.0))

    rv_amt = float(params.get("reverb_amount", 0.0))
    if rv_amt > 0:
        eq_plugins.append(Reverb(
            room_size=float(params["reverb_room_size"]),
            damping=0.5,
            wet_level=rv_amt,
            dry_level=1.0 - rv_amt * 0.4,
            width=1.0,
        ))

    pb = Pedalboard(eq_plugins)
    data = pb(data.T, rate).T

    # --- Transient shaper ---
    data = apply_transient_shaper(
        data,
        float(params.get("transient_attack", 0.0)),
        float(params.get("transient_sustain", 0.0)),
    )

    # --- Stereo width (M/S) ---
    data = apply_stereo_width(data, float(params.get("stereo_width", 1.0)))

    # --- Final LUFS normalization to target ---
    meter = pyln.Meter(rate)
    pre_lufs = meter.integrated_loudness(data)
    if pre_lufs is not None and not (isinstance(pre_lufs, float) and pre_lufs != pre_lufs) and pre_lufs > -70:
        data = pyln.normalize.loudness(data, pre_lufs, target_lufs)

    # --- Brickwall true-peak limiter ---
    data = apply_limiter_ceiling(data, float(params.get("limiter_ceiling_db", -1.0)))

    out_lufs = meter.integrated_loudness(data)
    if out_lufs is None or (isinstance(out_lufs, float) and out_lufs != out_lufs):
        out_lufs = target_lufs

    return data, float(out_lufs)


# ---------------------------------------------------------------------------
# Low-level DSP utilities
# ---------------------------------------------------------------------------

def apply_transient_shaper(data, attack: float, sustain: float):
    import numpy as np
    if abs(attack) < 1e-3 and abs(sustain) < 1e-3:
        return data

    out = np.copy(data)
    for ch in range(data.shape[1]):
        x = data[:, ch]
        envelope = np.abs(x)
        fast = np.zeros_like(envelope)
        slow = np.zeros_like(envelope)
        a_fast, a_slow = 0.4, 0.02
        for i in range(1, len(envelope)):
            fast[i] = a_fast * envelope[i] + (1 - a_fast) * fast[i - 1]
            slow[i] = a_slow * envelope[i] + (1 - a_slow) * slow[i - 1]
        diff = fast - slow
        attack_gain = 1.0 + attack * np.clip(diff / (np.abs(slow) + 1e-6), 0, 1)
        sustain_gain = 1.0 + sustain * np.clip(-diff / (np.abs(slow) + 1e-6), 0, 1)
        out[:, ch] = x * attack_gain * sustain_gain
    return np.tanh(out * 0.8) / 0.8


def apply_stereo_width(data, width: float):
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
    import numpy as np
    ceiling = 10 ** (ceiling_db / 20.0)
    peak = float(np.max(np.abs(data)))
    if peak > ceiling and peak > 0:
        data = data * (ceiling / peak)
    return np.clip(data, -1.0, 1.0)


# ---------------------------------------------------------------------------
# Main 3-stage pipeline
# ---------------------------------------------------------------------------

def process_with_params(
    data,
    rate: int,
    params: dict[str, Any],
    target_lufs: float,
    progress_base: int = 0,
    progress_range: int = 75,
    report: bool = True,
) -> tuple:
    """
    Run the full 3-stage mastering pipeline.
    Returns (processed_data, output_lufs).
    """
    step = progress_range // 3

    # Stage 1: Denoise & Compress
    data = stage1_denoise_compress(data, rate, params)
    if report:
        report_progress(progress_base + step)

    # Stage 2: Trim & Limit
    data = stage2_trim_limit(data, rate, params, target_lufs)
    if report:
        report_progress(progress_base + step * 2)

    # Stage 3: Transient Enhancement & Master
    data, out_lufs = stage3_enhance_master(data, rate, params, target_lufs)
    if report:
        report_progress(progress_base + progress_range)

    return data, out_lufs


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------

def run_single(
    input_path: str,
    output_path: str,
    preset: str,
    target_lufs: float,
    custom_params: Optional[dict[str, Any]] = None,
    analysis: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    import pyloudnorm as pyln

    data, rate = load_audio(input_path)
    report_progress(10)

    meter = pyln.Meter(rate)
    in_lufs = meter.integrated_loudness(data)
    if in_lufs is None or (isinstance(in_lufs, float) and in_lufs != in_lufs):
        in_lufs = -70.0

    base = PRESET_PARAMS.get(preset, PRESET_PARAMS["streaming"])
    params = merge_params(base, custom_params or {})

    if analysis:
        params = adapt_params_to_analysis(params, analysis, target_lufs)

    report_progress(20)

    processed, out_lufs = process_with_params(
        data, rate, params, target_lufs,
        progress_base=20, progress_range=70,
    )

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
    custom_params: Optional[dict[str, Any]] = None,
    analysis: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate all 3 AI variations. The 'ai_pick' variant is also written
    to `primary_output` so legacy single-output consumers still work."""
    import pyloudnorm as pyln
    os.makedirs(variants_dir, exist_ok=True)

    data, rate = load_audio(input_path)
    report_progress(8)

    meter = pyln.Meter(rate)
    in_lufs = meter.integrated_loudness(data)
    if in_lufs is None or (isinstance(in_lufs, float) and in_lufs != in_lufs):
        in_lufs = -70.0

    base_preset = PRESET_PARAMS.get(preset, PRESET_PARAMS["streaming"])
    base_params = merge_params(base_preset, custom_params or {})
    if analysis:
        base_params = adapt_params_to_analysis(base_params, analysis, target_lufs)

    variant_ids = list(VARIATION_STRATEGIES.keys())
    n = len(variant_ids)
    variants_meta = []

    for i, vid in enumerate(variant_ids):
        strat = VARIATION_STRATEGIES[vid]
        params = merge_params(base_params, strat["overrides"])

        # Each variation gets its own 3-stage pass
        v_data = data.copy()
        v_processed, v_lufs = process_with_params(
            v_data, rate, params, target_lufs,
            progress_base=10 + int(i / n * 80),
            progress_range=int(80 / n),
            report=True,
        )

        out_path = os.path.join(variants_dir, f"variant_{vid}.wav")
        write_audio(out_path, v_processed, rate)
        if vid == "ai_pick":
            write_audio(primary_output, v_processed, rate)

        variants_meta.append({
            "id": vid,
            "label": strat["label"],
            "description": strat["description"],
            "outputPath": out_path,
            "outputLufs": v_lufs,
        })

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


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({
            "type": "error",
            "error": "Usage: audioMastering.py <input> <output> <preset> <target_lufs> [--params <json>] [--analysis <json>] [--variations <dir>]",
        }))
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    preset = sys.argv[3]
    target_lufs = float(sys.argv[4])

    custom_params: Optional[dict[str, Any]] = None
    variants_dir: Optional[str] = None
    analysis: Optional[dict[str, Any]] = None

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
        elif args[i] == "--analysis" and i + 1 < len(args):
            try:
                analysis = json.loads(args[i + 1])
            except json.JSONDecodeError:
                analysis = None
            i += 2
        else:
            if custom_params is None and args[i].startswith("{"):
                try:
                    custom_params = json.loads(args[i])
                except json.JSONDecodeError:
                    pass
            i += 1

    try:
        if variants_dir:
            result = run_variations(
                input_path, output_path, variants_dir, preset, target_lufs, custom_params, analysis,
            )
        else:
            result = run_single(
                input_path, output_path, preset, target_lufs, custom_params, analysis,
            )
        print(json.dumps({"type": "result", **result}, default=str), flush=True)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({
            "type": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), flush=True)
        sys.exit(1)
