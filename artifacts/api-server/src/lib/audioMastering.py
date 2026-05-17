#!/usr/bin/env python3
"""
AI Audio Mastering Engine v4 — Genre-Aware Adaptive Pipeline

Stages:
  1. Denoise & De-ess & Compress   — clean, tame, remove harshness
  2. Trim & Limit                  — silence removal, working-level normalization
  3. Multiband Compress & Master   — tonal EQ, multiband dynamics, stereo, limiter

Genre presets: streaming · club · warm_vinyl · broadcast · afrobeats · hiphop · trap · custom

CLI:
  python audioMastering.py <input> <output> <preset> <target_lufs>
    [--params <json>] [--analysis <json>] [--variations <dir>]
    [--reference <path>]   # optional reference track for Matchering
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
        "deesser_threshold_db": -18.0,
        "deesser_freq_hz": 7000.0,
        "deesser_bandwidth_hz": 4000.0,
        "deesser_ratio": 4.0,
        "low_shelf_db": 0.5,
        "low_shelf_hz": 120.0,
        "mid_db": 0.0,
        "mid_hz": 1000.0,
        "presence_db": 0.5,
        "presence_hz": 4000.0,
        "air_db": 1.0,
        "air_hz": 12000.0,
        "multiband_low_threshold_db": -20.0,
        "multiband_low_ratio": 2.0,
        "multiband_mid_threshold_db": -18.0,
        "multiband_mid_ratio": 2.5,
        "multiband_high_threshold_db": -22.0,
        "multiband_high_ratio": 2.0,
        "compressor_threshold_db": -16.0,
        "compressor_ratio": 2.5,
        "compressor_attack_ms": 12.0,
        "compressor_release_ms": 120.0,
        "transient_attack": 0.05,
        "transient_sustain": 0.0,
        "saturation_amount": 0.06,
        "stereo_width": 1.10,
        "reverb_amount": 0.02,
        "reverb_room_size": 0.20,
        "limiter_ceiling_db": -1.0,
    },
    "afrobeats": {
        "voice_cleanup": True,
        "noise_gate_db": -55.0,
        "denoise_amount": 0.10,
        "deesser_threshold_db": -16.0,
        "deesser_freq_hz": 6500.0,
        "deesser_bandwidth_hz": 3500.0,
        "deesser_ratio": 3.5,
        "low_shelf_db": 2.5,
        "low_shelf_hz": 80.0,
        "mid_db": -0.5,
        "mid_hz": 400.0,
        "presence_db": 1.5,
        "presence_hz": 3500.0,
        "air_db": 2.0,
        "air_hz": 11000.0,
        "multiband_low_threshold_db": -18.0,
        "multiband_low_ratio": 3.0,
        "multiband_mid_threshold_db": -20.0,
        "multiband_mid_ratio": 2.0,
        "multiband_high_threshold_db": -24.0,
        "multiband_high_ratio": 1.8,
        "compressor_threshold_db": -14.0,
        "compressor_ratio": 3.0,
        "compressor_attack_ms": 8.0,
        "compressor_release_ms": 100.0,
        "transient_attack": 0.15,
        "transient_sustain": 0.10,
        "saturation_amount": 0.10,
        "stereo_width": 1.20,
        "reverb_amount": 0.03,
        "reverb_room_size": 0.22,
        "limiter_ceiling_db": -0.5,
    },
    "hiphop": {
        "voice_cleanup": True,
        "noise_gate_db": -52.0,
        "denoise_amount": 0.12,
        "deesser_threshold_db": -15.0,
        "deesser_freq_hz": 7500.0,
        "deesser_bandwidth_hz": 4000.0,
        "deesser_ratio": 4.0,
        "low_shelf_db": 3.0,
        "low_shelf_hz": 70.0,
        "mid_db": -1.0,
        "mid_hz": 350.0,
        "presence_db": 2.0,
        "presence_hz": 4000.0,
        "air_db": 1.5,
        "air_hz": 12000.0,
        "multiband_low_threshold_db": -16.0,
        "multiband_low_ratio": 3.5,
        "multiband_mid_threshold_db": -20.0,
        "multiband_mid_ratio": 2.0,
        "multiband_high_threshold_db": -22.0,
        "multiband_high_ratio": 2.5,
        "compressor_threshold_db": -12.0,
        "compressor_ratio": 3.5,
        "compressor_attack_ms": 6.0,
        "compressor_release_ms": 90.0,
        "transient_attack": 0.20,
        "transient_sustain": 0.05,
        "saturation_amount": 0.12,
        "stereo_width": 1.15,
        "reverb_amount": 0.02,
        "reverb_room_size": 0.18,
        "limiter_ceiling_db": -0.3,
    },
    "trap": {
        "voice_cleanup": True,
        "noise_gate_db": -50.0,
        "denoise_amount": 0.10,
        "deesser_threshold_db": -14.0,
        "deesser_freq_hz": 8000.0,
        "deesser_bandwidth_hz": 5000.0,
        "deesser_ratio": 5.0,
        "low_shelf_db": 4.0,
        "low_shelf_hz": 60.0,
        "mid_db": -2.0,
        "mid_hz": 300.0,
        "presence_db": 1.5,
        "presence_hz": 5000.0,
        "air_db": 2.5,
        "air_hz": 13000.0,
        "multiband_low_threshold_db": -14.0,
        "multiband_low_ratio": 4.0,
        "multiband_mid_threshold_db": -22.0,
        "multiband_mid_ratio": 1.8,
        "multiband_high_threshold_db": -20.0,
        "multiband_high_ratio": 3.0,
        "compressor_threshold_db": -10.0,
        "compressor_ratio": 4.0,
        "compressor_attack_ms": 4.0,
        "compressor_release_ms": 80.0,
        "transient_attack": 0.25,
        "transient_sustain": 0.10,
        "saturation_amount": 0.15,
        "stereo_width": 1.25,
        "reverb_amount": 0.015,
        "reverb_room_size": 0.15,
        "limiter_ceiling_db": -0.1,
    },
    "club": {
        "voice_cleanup": True,
        "noise_gate_db": -55.0,
        "denoise_amount": 0.10,
        "deesser_threshold_db": -16.0,
        "deesser_freq_hz": 7000.0,
        "deesser_bandwidth_hz": 4000.0,
        "deesser_ratio": 3.0,
        "low_shelf_db": 2.5,
        "low_shelf_hz": 90.0,
        "mid_db": -0.5,
        "mid_hz": 500.0,
        "presence_db": 2.0,
        "presence_hz": 5000.0,
        "air_db": 2.0,
        "air_hz": 12000.0,
        "multiband_low_threshold_db": -15.0,
        "multiband_low_ratio": 3.5,
        "multiband_mid_threshold_db": -18.0,
        "multiband_mid_ratio": 2.5,
        "multiband_high_threshold_db": -20.0,
        "multiband_high_ratio": 2.5,
        "compressor_threshold_db": -14.0,
        "compressor_ratio": 4.0,
        "compressor_attack_ms": 5.0,
        "compressor_release_ms": 80.0,
        "transient_attack": 0.25,
        "transient_sustain": 0.10,
        "saturation_amount": 0.18,
        "stereo_width": 1.20,
        "reverb_amount": 0.02,
        "reverb_room_size": 0.20,
        "limiter_ceiling_db": -0.3,
    },
    "warm_vinyl": {
        "voice_cleanup": True,
        "noise_gate_db": -60.0,
        "denoise_amount": 0.15,
        "deesser_threshold_db": -20.0,
        "deesser_freq_hz": 6000.0,
        "deesser_bandwidth_hz": 3000.0,
        "deesser_ratio": 3.0,
        "low_shelf_db": 1.5,
        "low_shelf_hz": 200.0,
        "mid_db": 0.5,
        "mid_hz": 800.0,
        "presence_db": 0.3,
        "presence_hz": 3500.0,
        "air_db": -1.0,
        "air_hz": 14000.0,
        "multiband_low_threshold_db": -22.0,
        "multiband_low_ratio": 2.0,
        "multiband_mid_threshold_db": -22.0,
        "multiband_mid_ratio": 1.8,
        "multiband_high_threshold_db": -26.0,
        "multiband_high_ratio": 1.5,
        "compressor_threshold_db": -18.0,
        "compressor_ratio": 2.0,
        "compressor_attack_ms": 25.0,
        "compressor_release_ms": 180.0,
        "transient_attack": 0.0,
        "transient_sustain": 0.20,
        "saturation_amount": 0.25,
        "stereo_width": 1.05,
        "reverb_amount": 0.06,
        "reverb_room_size": 0.30,
        "limiter_ceiling_db": -1.5,
    },
    "broadcast": {
        "voice_cleanup": True,
        "noise_gate_db": -50.0,
        "denoise_amount": 0.20,
        "deesser_threshold_db": -14.0,
        "deesser_freq_hz": 6500.0,
        "deesser_bandwidth_hz": 3000.0,
        "deesser_ratio": 5.0,
        "low_shelf_db": -1.0,
        "low_shelf_hz": 80.0,
        "mid_db": 0.5,
        "mid_hz": 1500.0,
        "presence_db": 1.5,
        "presence_hz": 4500.0,
        "air_db": 0.5,
        "air_hz": 11000.0,
        "multiband_low_threshold_db": -22.0,
        "multiband_low_ratio": 2.5,
        "multiband_mid_threshold_db": -18.0,
        "multiband_mid_ratio": 3.0,
        "multiband_high_threshold_db": -20.0,
        "multiband_high_ratio": 2.0,
        "compressor_threshold_db": -16.0,
        "compressor_ratio": 3.0,
        "compressor_attack_ms": 8.0,
        "compressor_release_ms": 100.0,
        "transient_attack": 0.05,
        "transient_sustain": 0.0,
        "saturation_amount": 0.04,
        "stereo_width": 1.00,
        "reverb_amount": 0.0,
        "reverb_room_size": 0.20,
        "limiter_ceiling_db": -2.0,
    },
    "custom": {
        "voice_cleanup": True,
        "noise_gate_db": -55.0,
        "denoise_amount": 0.15,
        "deesser_threshold_db": -18.0,
        "deesser_freq_hz": 7000.0,
        "deesser_bandwidth_hz": 4000.0,
        "deesser_ratio": 4.0,
        "low_shelf_db": 1.0,
        "low_shelf_hz": 120.0,
        "mid_db": 0.0,
        "mid_hz": 1000.0,
        "presence_db": 0.5,
        "presence_hz": 4000.0,
        "air_db": 1.0,
        "air_hz": 12000.0,
        "multiband_low_threshold_db": -20.0,
        "multiband_low_ratio": 2.5,
        "multiband_mid_threshold_db": -18.0,
        "multiband_mid_ratio": 2.5,
        "multiband_high_threshold_db": -22.0,
        "multiband_high_ratio": 2.0,
        "compressor_threshold_db": -16.0,
        "compressor_ratio": 3.0,
        "compressor_attack_ms": 12.0,
        "compressor_release_ms": 120.0,
        "transient_attack": 0.10,
        "transient_sustain": 0.0,
        "saturation_amount": 0.08,
        "stereo_width": 1.10,
        "reverb_amount": 0.02,
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
            "saturation_amount": "+0.08",
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
            "reverb_amount": "+0.03",
            "transient_attack": "-0.05",
            "deesser_threshold_db": "-2.0",
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
    sub_ratio = analysis.get("sub_bass_ratio", 0.1)
    sibilance_ratio = analysis.get("sibilance_ratio", 0.05)
    genre_hint = analysis.get("genre_hint", "general")

    # Low-end
    if low_ratio > 0.45:
        p["low_shelf_db"] = max(float(p.get("low_shelf_db", 1.0)) - 2.0, -3.0)
    elif low_ratio < 0.18:
        p["low_shelf_db"] = min(float(p.get("low_shelf_db", 1.0)) + 1.5, 5.0)

    # Sub-bass (genre-aware)
    if sub_ratio > 0.30 and genre_hint in ("trap", "hiphop"):
        p["multiband_low_threshold_db"] = float(p.get("multiband_low_threshold_db", -20.0)) - 2.0
        p["multiband_low_ratio"] = min(float(p.get("multiband_low_ratio", 2.0)) * 1.2, 5.0)

    # Dynamics — back off compression on already-squashed tracks
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
        p["air_db"] = min(float(p.get("air_db", 1.0)) + 1.0, 4.0)
    elif spectral_centroid > 4000.0:
        p["air_db"] = max(float(p.get("air_db", 1.0)) - 1.0, -1.0)

    # De-esser — tighten if track is sibilant / was reported harsh
    if sibilance_ratio > 0.08:
        p["deesser_threshold_db"] = float(p.get("deesser_threshold_db", -18.0)) - 4.0
        p["deesser_ratio"] = min(float(p.get("deesser_ratio", 4.0)) + 2.0, 8.0)
    elif sibilance_ratio > 0.05:
        p["deesser_threshold_db"] = float(p.get("deesser_threshold_db", -18.0)) - 2.0

    # Headroom — reduce saturation if already close to target
    if abs(integrated - target_lufs) < 2.0:
        p["saturation_amount"] = max(float(p.get("saturation_amount", 0.06)) * 0.5, 0.0)
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
# DSP utilities
# ---------------------------------------------------------------------------

def apply_deesser(data, rate: int, params: dict[str, Any]):
    """
    Frequency-selective dynamic de-esser.
    Isolates the sibilance band, measures its RMS per frame, and applies
    gain reduction to the full signal when that band exceeds the threshold.
    This removes harshness without dulling the overall top-end.
    """
    import numpy as np
    from scipy import signal as sp

    threshold_db = float(params.get("deesser_threshold_db", -18.0))
    center_hz = float(params.get("deesser_freq_hz", 7000.0))
    bw_hz = float(params.get("deesser_bandwidth_hz", 4000.0))
    ratio = float(params.get("deesser_ratio", 4.0))

    if ratio <= 1.0:
        return data

    threshold_lin = 10 ** (threshold_db / 20.0)
    low_hz = max(center_hz - bw_hz / 2, 1000.0)
    high_hz = min(center_hz + bw_hz / 2, rate / 2 - 1)

    # Bandpass filter to isolate sibilance band
    sos = sp.butter(4, [low_hz, high_hz], btype="band", fs=rate, output="sos")
    mono = data.mean(axis=1)
    sib_band = sp.sosfilt(sos, mono)

    # Frame-based RMS detector
    frame = max(int(rate * 0.005), 64)  # 5 ms frames
    hop = frame // 2
    n_frames = (len(sib_band) - frame) // hop + 1

    gain = np.ones(len(mono), dtype=np.float32)

    for i in range(n_frames):
        s = i * hop
        e = s + frame
        rms = float(np.sqrt(np.mean(sib_band[s:e] ** 2)))
        if rms > threshold_lin:
            reduction = threshold_lin + (rms - threshold_lin) / ratio
            g = reduction / (rms + 1e-9)
            # Smooth gain with linear ramp across frame
            gain[s:e] = np.minimum(gain[s:e], np.full(e - s, float(g), dtype=np.float32))

    # Smooth the gain curve with a short moving average
    kernel = int(rate * 0.003)  # 3 ms smoothing
    if kernel > 1:
        gain = np.convolve(gain, np.ones(kernel) / kernel, mode="same")

    out = data.copy()
    out[:, 0] *= gain
    out[:, 1] *= gain
    return out


def apply_multiband_compress(data, rate: int, params: dict[str, Any]):
    """
    3-band multiband compressor using butterworth crossovers.
    Bands: lows (<200 Hz) · mids (200–4000 Hz) · highs (>4000 Hz)
    Each band is compressed independently then summed.
    """
    import numpy as np
    from scipy import signal as sp

    lo_thresh = float(params.get("multiband_low_threshold_db", -20.0))
    lo_ratio = float(params.get("multiband_low_ratio", 2.0))
    mid_thresh = float(params.get("multiband_mid_threshold_db", -18.0))
    mid_ratio = float(params.get("multiband_mid_ratio", 2.5))
    hi_thresh = float(params.get("multiband_high_threshold_db", -22.0))
    hi_ratio = float(params.get("multiband_high_ratio", 2.0))

    xover_lo = 200.0
    xover_hi = 4000.0
    order = 4

    # Design crossover filters
    sos_lo = sp.butter(order, xover_lo, btype="low", fs=rate, output="sos")
    sos_mid_lo = sp.butter(order, xover_lo, btype="high", fs=rate, output="sos")
    sos_mid_hi = sp.butter(order, xover_hi, btype="low", fs=rate, output="sos")
    sos_hi = sp.butter(order, xover_hi, btype="high", fs=rate, output="sos")

    def compress_band(band, threshold_db, ratio):
        """RMS-envelope compressor applied per-channel."""
        if ratio <= 1.0:
            return band
        thresh = 10 ** (threshold_db / 20.0)
        out = np.copy(band)
        for ch in range(band.shape[1]):
            x = band[:, ch]
            # Envelope follower
            env = np.abs(x)
            attack_coeff = np.exp(-1.0 / (rate * 0.005))
            release_coeff = np.exp(-1.0 / (rate * 0.060))
            smooth_env = np.zeros_like(env)
            smooth_env[0] = env[0]
            for i in range(1, len(env)):
                if env[i] > smooth_env[i - 1]:
                    smooth_env[i] = attack_coeff * smooth_env[i - 1] + (1 - attack_coeff) * env[i]
                else:
                    smooth_env[i] = release_coeff * smooth_env[i - 1] + (1 - release_coeff) * env[i]
            gain = np.where(
                smooth_env > thresh,
                thresh * ((smooth_env / (thresh + 1e-9)) ** (1.0 / ratio)) / (smooth_env + 1e-9),
                np.ones_like(smooth_env),
            )
            out[:, ch] = x * gain
        return out

    def split_and_compress(data, sos_lp, sos_hp, threshold_db, ratio):
        lo = np.stack([sp.sosfilt(sos_lp, data[:, 0]),
                       sp.sosfilt(sos_lp, data[:, 1])], axis=1).astype(np.float32)
        hi = np.stack([sp.sosfilt(sos_hp, data[:, 0]),
                       sp.sosfilt(sos_hp, data[:, 1])], axis=1).astype(np.float32)
        return compress_band(lo, threshold_db, ratio), hi

    # Low band
    lo_band, rest = split_and_compress(data, sos_lo, sos_mid_lo, lo_thresh, lo_ratio)

    # Mid band
    mid_band, hi_band_raw = split_and_compress(rest, sos_mid_hi, sos_hi, mid_thresh, mid_ratio)

    # High band
    hi_band = compress_band(hi_band_raw, hi_thresh, hi_ratio)

    return (lo_band + mid_band + hi_band).astype(np.float32)


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
    import numpy as np
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
# Stage 1 — Denoise, De-ess & Compress
# ---------------------------------------------------------------------------

def stage1_denoise_deess_compress(data, rate: int, params: dict[str, Any]):
    """
    1a. Noise gate (remove floor noise)
    1b. De-esser (remove sibilance / harshness BEFORE compression)
    1c. Glue compressor (tame dynamics on clean, de-essed material)
    """
    from pedalboard import Pedalboard, NoiseGate, Compressor

    # Noise gate
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
    data = pb(data.T, rate).T

    # De-esser after noise gate, before multiband
    data = apply_deesser(data, rate, params)

    return data


# ---------------------------------------------------------------------------
# Stage 2 — Trim & Limit
# ---------------------------------------------------------------------------

def stage2_trim_limit(data, rate: int, params: dict[str, Any], target_lufs: float):
    import numpy as np
    import pyloudnorm as pyln

    gate_lin = 10 ** (float(params.get("noise_gate_db", -55.0)) / 20.0)
    mono = np.abs(data).max(axis=1)
    above = np.where(mono > gate_lin)[0]
    if len(above) >= 2:
        fade = int(rate * 0.01)
        start = max(0, above[0] - fade)
        end = min(len(data), above[-1] + fade)
        data = data[start:end]

    meter = pyln.Meter(rate)
    lufs = meter.integrated_loudness(data)
    if lufs is not None and not (isinstance(lufs, float) and lufs != lufs) and lufs > -70:
        data = pyln.normalize.loudness(data, lufs, target_lufs + 2.0)

    soft_ceil = 10 ** (-3.0 / 20.0)
    peak = float(np.max(np.abs(data)))
    if peak > soft_ceil and peak > 0:
        data = data * (soft_ceil / peak)

    return data


# ---------------------------------------------------------------------------
# Stage 3 — Multiband Compress, EQ & Master
# ---------------------------------------------------------------------------

def stage3_multiband_master(data, rate: int, params: dict[str, Any], target_lufs: float):
    """
    3a. Multiband compression (3 bands: lows / mids / highs)
    3b. Tonal EQ (low shelf + mid peak + presence + air)
    3c. Transient shaping
    3d. M/S stereo widening
    3e. Harmonic saturation
    3f. Optional subtle reverb
    3g. Final LUFS normalization
    3h. Brickwall true-peak limiter
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

    # 3a — Multiband compression
    data = apply_multiband_compress(data, rate, params)

    # 3b — Tonal EQ
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
        eq_plugins.append(Distortion(drive_db=sat * 14.0))
        eq_plugins.append(Gain(gain_db=-sat * 3.0))

    rv_amt = float(params.get("reverb_amount", 0.0))
    if rv_amt > 0:
        eq_plugins.append(Reverb(
            room_size=float(params["reverb_room_size"]),
            damping=0.6,
            wet_level=rv_amt,
            dry_level=1.0 - rv_amt * 0.3,
            width=1.0,
        ))

    pb = Pedalboard(eq_plugins)
    data = pb(data.T, rate).T

    # 3c — Transient shaper
    data = apply_transient_shaper(
        data,
        float(params.get("transient_attack", 0.0)),
        float(params.get("transient_sustain", 0.0)),
    )

    # 3d — Stereo width (M/S)
    data = apply_stereo_width(data, float(params.get("stereo_width", 1.0)))

    # 3g — Final LUFS normalization
    meter = pyln.Meter(rate)
    pre_lufs = meter.integrated_loudness(data)
    if pre_lufs is not None and not (isinstance(pre_lufs, float) and pre_lufs != pre_lufs) and pre_lufs > -70:
        data = pyln.normalize.loudness(data, pre_lufs, target_lufs)

    # 3h — Brickwall true-peak limiter
    data = apply_limiter_ceiling(data, float(params.get("limiter_ceiling_db", -1.0)))

    out_lufs = meter.integrated_loudness(data)
    if out_lufs is None or (isinstance(out_lufs, float) and out_lufs != out_lufs):
        out_lufs = target_lufs

    return data, float(out_lufs)


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
    step = progress_range // 3

    data = stage1_denoise_deess_compress(data, rate, params)
    if report:
        report_progress(progress_base + step)

    data = stage2_trim_limit(data, rate, params, target_lufs)
    if report:
        report_progress(progress_base + step * 2)

    data, out_lufs = stage3_multiband_master(data, rate, params, target_lufs)
    if report:
        report_progress(progress_base + progress_range)

    return data, out_lufs


# ---------------------------------------------------------------------------
# Reference-based mastering (Matchering)
# ---------------------------------------------------------------------------

def run_matchering(input_path: str, reference_path: str, output_path: str) -> dict[str, Any]:
    """
    Match the tonal balance, loudness, and dynamics of a reference track.
    Uses the Matchering library.
    """
    import matchering as mg

    results = []
    mg.process(
        target=input_path,
        reference=reference_path,
        results=[mg.pcm24(output_path)],
    )
    return {"method": "matchering", "output": output_path}


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
    reference_path: Optional[str] = None,
) -> dict[str, Any]:
    import pyloudnorm as pyln

    # Reference-based mastering path
    if reference_path and os.path.isfile(reference_path):
        report_progress(10)
        try:
            result = run_matchering(input_path, reference_path, output_path)
            report_progress(100)
            data, rate = load_audio(output_path)
            meter = pyln.Meter(rate)
            out_lufs = meter.integrated_loudness(data)
            return {
                "method": "reference_matching",
                "output_lufs": float(out_lufs) if out_lufs else target_lufs,
                "params_used": {},
            }
        except Exception as e:
            # Fall through to standard pipeline if matchering fails
            pass

    data, rate = load_audio(input_path)
    report_progress(10)

    meter = pyln.Meter(rate)
    in_lufs = meter.integrated_loudness(data)
    if in_lufs is None or (isinstance(in_lufs, float) and in_lufs != in_lufs):
        in_lufs = -70.0

    # Auto-select genre preset from analysis genre_hint if preset is "streaming"
    effective_preset = preset
    if preset == "streaming" and analysis:
        genre_hint = analysis.get("genre_hint", "general")
        if genre_hint in PRESET_PARAMS:
            effective_preset = genre_hint

    base = PRESET_PARAMS.get(effective_preset, PRESET_PARAMS["streaming"])
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
        "preset_used": effective_preset,
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
    import pyloudnorm as pyln
    os.makedirs(variants_dir, exist_ok=True)

    data, rate = load_audio(input_path)
    report_progress(8)

    meter = pyln.Meter(rate)
    in_lufs = meter.integrated_loudness(data)
    if in_lufs is None or (isinstance(in_lufs, float) and in_lufs != in_lufs):
        in_lufs = -70.0

    effective_preset = preset
    if preset == "streaming" and analysis:
        genre_hint = analysis.get("genre_hint", "general")
        if genre_hint in PRESET_PARAMS:
            effective_preset = genre_hint

    base_preset = PRESET_PARAMS.get(effective_preset, PRESET_PARAMS["streaming"])
    base_params = merge_params(base_preset, custom_params or {})
    if analysis:
        base_params = adapt_params_to_analysis(base_params, analysis, target_lufs)

    variant_ids = list(VARIATION_STRATEGIES.keys())
    n = len(variant_ids)
    variants_meta = []

    for i, vid in enumerate(variant_ids):
        strat = VARIATION_STRATEGIES[vid]
        params = merge_params(base_params, strat["overrides"])

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
        "preset_used": effective_preset,
        "variants": variants_meta,
        "params_used": base_params,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("preset")
    parser.add_argument("target_lufs", type=float)
    parser.add_argument("--params", default=None)
    parser.add_argument("--analysis", default=None)
    parser.add_argument("--variations", default=None)
    parser.add_argument("--reference", default=None)
    args = parser.parse_args()

    try:
        custom_params = json.loads(args.params) if args.params else None
        analysis = json.loads(args.analysis) if args.analysis else None

        if args.variations:
            result = run_variations(
                args.input, args.output, args.variations,
                args.preset, args.target_lufs,
                custom_params, analysis,
            )
        else:
            result = run_single(
                args.input, args.output,
                args.preset, args.target_lufs,
                custom_params, analysis,
                reference_path=args.reference,
            )

        print(json.dumps({"type": "result", **result}), flush=True)

    except Exception as e:
        print(json.dumps({"type": "error", "error": str(e), "traceback": traceback.format_exc()}), flush=True)
        sys.exit(1)
