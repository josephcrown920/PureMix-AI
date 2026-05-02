#!/usr/bin/env python3
"""
AI Audio Mastering Script
Applies professional mastering techniques to audio files:
- Loudness normalization (LUFS targeting)
- Multi-band EQ with bass/brightness tweaks
- Dynamic compression (light / medium / heavy)
- Stereo width enhancement
- Warmth (harmonic saturation)
- Punch (transient enhancement)
- Brickwall limiting
"""

import sys
import json
import os
import tempfile
import traceback


def process_audio(input_path: str, output_path: str, preset: str,
                  target_lufs: float, custom: dict) -> dict:
    """
    Master an audio file with the given preset, target LUFS and optional
    custom parameters.
    Returns a dict with measured_input_lufs, measured_output_lufs
    """
    import numpy as np
    import soundfile as sf
    import pyloudnorm as pyln
    from scipy import signal

    # Determine input format; soundfile cannot read MP3, so convert via pydub
    ext = os.path.splitext(input_path)[1].lower()
    if ext in ('.mp3', '.m4a', '.aac', '.ogg'):
        from pydub import AudioSegment
        audio_seg = AudioSegment.from_file(input_path)
        tmp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp_wav.close()
        audio_seg.export(tmp_wav.name, format='wav')
        read_path = tmp_wav.name
    else:
        read_path = input_path
        tmp_wav = None

    try:
        data, rate = sf.read(read_path)
    finally:
        if tmp_wav is not None:
            try:
                os.unlink(tmp_wav.name)
            except OSError:
                pass

    # Ensure stereo
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    elif data.shape[1] > 2:
        data = data[:, :2]

    # Measure input loudness
    meter = pyln.Meter(rate)
    input_loudness = meter.integrated_loudness(data)
    report_progress(20)

    # Apply preset EQ
    data = apply_eq(data, rate, preset)

    # Apply custom bass enhancement
    bass_db = float(custom.get('bass_db', 0))
    if abs(bass_db) > 0.01:
        data = apply_shelf_eq(data, rate, freq=200, gain_db=bass_db, shelf_type='low')

    # Apply custom brightness/air
    brightness_db = float(custom.get('brightness_db', 0))
    if abs(brightness_db) > 0.01:
        data = apply_shelf_eq(data, rate, freq=10000, gain_db=brightness_db, shelf_type='high')

    report_progress(40)

    # Apply compression (custom level overrides preset default)
    compression_level = custom.get('compression', None)
    data = apply_compression(data, preset, compression_level)
    report_progress(55)

    # Warmth — harmonic saturation (soft even-order harmonics)
    if custom.get('warmth', False):
        data = apply_warmth(data)
    report_progress(62)

    # Punch — transient enhancement via upward transient expansion
    if custom.get('punch', False):
        data = apply_punch(data, rate)
    report_progress(68)

    # Stereo width
    stereo_width = float(custom.get('stereo_width', 0))  # 0 = use preset default
    data = apply_stereo_enhancement(data, preset, stereo_width if stereo_width > 0 else None)
    report_progress(75)

    # Normalize to target LUFS
    data = pyln.normalize.loudness(data, input_loudness, target_lufs)
    report_progress(85)

    # Brickwall limiting
    data = apply_limiter(data)
    report_progress(92)

    # Measure output loudness
    output_loudness = meter.integrated_loudness(data)

    # Clip to valid range
    data = np.clip(data, -1.0, 1.0)

    sf.write(output_path, data, rate, subtype='PCM_24')
    report_progress(100)

    return {
        "input_lufs": float(input_loudness) if not _is_nan(input_loudness) else -70.0,
        "output_lufs": float(output_loudness) if not _is_nan(output_loudness) else target_lufs,
    }


def _is_nan(v):
    try:
        return v is None or (isinstance(v, float) and v != v)
    except Exception:
        return True


# ──────────────────────────────────────────────────────────────────────────────
# EQ helpers
# ──────────────────────────────────────────────────────────────────────────────

def apply_eq(data: 'np.ndarray', rate: int, preset: str) -> 'np.ndarray':
    """Apply preset EQ curves."""
    from scipy import signal
    import numpy as np

    if preset == "streaming":
        b_high, a_high = signal.butter(2, 12000 / (rate / 2), btype='highpass')
        high_shelf = signal.filtfilt(b_high, a_high, data, axis=0) * 0.15
        b_low, a_low = signal.butter(2, 60 / (rate / 2), btype='lowpass')
        low_cut = data - signal.filtfilt(b_low, a_low, data, axis=0) * 0.1
        return low_cut + high_shelf * 0.3

    elif preset == "club":
        b_sub, a_sub = signal.butter(2, [40 / (rate / 2), 100 / (rate / 2)], btype='bandpass')
        sub_boost = signal.filtfilt(b_sub, a_sub, data, axis=0) * 0.2
        b_pres, a_pres = signal.butter(2, [3000 / (rate / 2), 8000 / (rate / 2)], btype='bandpass')
        pres_boost = signal.filtfilt(b_pres, a_pres, data, axis=0) * 0.15
        return data + sub_boost + pres_boost

    elif preset == "warm_vinyl":
        b_roll, a_roll = signal.butter(2, 14000 / (rate / 2), btype='lowpass')
        rolled = signal.filtfilt(b_roll, a_roll, data, axis=0)
        b_warmth, a_warmth = signal.butter(2, [200 / (rate / 2), 800 / (rate / 2)], btype='bandpass')
        warmth_boost = signal.filtfilt(b_warmth, a_warmth, data, axis=0) * 0.1
        return rolled + warmth_boost

    elif preset == "broadcast":
        b_hp, a_hp = signal.butter(2, 80 / (rate / 2), btype='highpass')
        filtered = signal.filtfilt(b_hp, a_hp, data, axis=0)
        b_lp, a_lp = signal.butter(2, 16000 / (rate / 2), btype='lowpass')
        return signal.filtfilt(b_lp, a_lp, filtered, axis=0)

    return data


def apply_shelf_eq(data: 'np.ndarray', rate: int, freq: float,
                   gain_db: float, shelf_type: str) -> 'np.ndarray':
    """
    First-order shelving EQ using the Audio EQ Cookbook bilinear transform.
    shelf_type: 'low' or 'high'
    gain_db: positive = boost, negative = cut
    """
    import numpy as np
    from scipy import signal

    A = 10 ** (gain_db / 40.0)           # amplitude (sqrt of power gain)
    w0 = 2 * np.pi * freq / rate
    alpha = np.sin(w0) / 2 * np.sqrt((A + 1 / A) * (1 / 1.0 - 1) + 2)  # S=1

    if shelf_type == 'low':
        b0 =  A * ((A + 1) - (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha)
        b1 =  2 * A * ((A - 1) - (A + 1) * np.cos(w0))
        b2 =  A * ((A + 1) - (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha)
        a0 =       (A + 1) + (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha
        a1 = -2 * ((A - 1) + (A + 1) * np.cos(w0))
        a2 =       (A + 1) + (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha
    else:  # high shelf
        b0 =  A * ((A + 1) + (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha)
        b1 = -2 * A * ((A - 1) + (A + 1) * np.cos(w0))
        b2 =  A * ((A + 1) + (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha)
        a0 =       (A + 1) - (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha
        a1 =  2 * ((A - 1) - (A + 1) * np.cos(w0))
        a2 =       (A + 1) - (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha

    b = np.array([b0 / a0, b1 / a0, b2 / a0])
    a = np.array([1.0, a1 / a0, a2 / a0])
    return signal.filtfilt(b, a, data, axis=0)


# ──────────────────────────────────────────────────────────────────────────────
# Compression
# ──────────────────────────────────────────────────────────────────────────────

def apply_compression(data: 'np.ndarray', preset: str,
                      level: str | None = None) -> 'np.ndarray':
    """RMS-based dynamic compression. level: 'light' | 'medium' | 'heavy'"""
    import numpy as np

    preset_defaults = {
        "streaming": "medium",
        "club":      "heavy",
        "warm_vinyl":"light",
        "broadcast": "medium",
        "custom":    "medium",
    }
    effective = level if level in ("light", "medium", "heavy") \
        else preset_defaults.get(preset, "medium")

    settings = {
        "light":  {"threshold": 0.65, "ratio": 2.0},
        "medium": {"threshold": 0.50, "ratio": 3.5},
        "heavy":  {"threshold": 0.35, "ratio": 6.0},
    }
    s = settings[effective]
    rms = np.sqrt(np.mean(data ** 2))
    if rms > s["threshold"]:
        gain = s["threshold"] / rms * (
            1 + (rms - s["threshold"]) / (s["ratio"] * (rms - s["threshold"] + 0.001))
        )
        data = data * gain
    return data


# ──────────────────────────────────────────────────────────────────────────────
# Warmth
# ──────────────────────────────────────────────────────────────────────────────

def apply_warmth(data: 'np.ndarray', amount: float = 0.18) -> 'np.ndarray':
    """
    Analog warmth via soft even-order harmonic saturation (arctan).
    Adds subtle 2nd/4th-order harmonics.
    """
    import numpy as np
    saturated = np.arctan(data * (1 + amount * 3)) / (np.pi / 2)
    return data * (1 - amount) + saturated * amount


# ──────────────────────────────────────────────────────────────────────────────
# Punch
# ──────────────────────────────────────────────────────────────────────────────

def apply_punch(data: 'np.ndarray', rate: int) -> 'np.ndarray':
    """
    Transient punch via multi-band transient detection and gain riding.
    Detects attacks on the low-mid band (80–500 Hz) and boosts them briefly.
    """
    import numpy as np
    from scipy import signal as sig

    # Isolate low-mid band for transient detection
    b, a = sig.butter(4, [80 / (rate / 2), 500 / (rate / 2)], btype='bandpass')
    low_mid = sig.filtfilt(b, a, data, axis=0)

    # Compute RMS envelope with fast attack, slow release
    frame = max(1, int(rate * 0.005))   # 5 ms frames
    hop   = max(1, frame // 2)
    n_frames = (len(data) - frame) // hop + 1
    if n_frames <= 1:
        return data

    rms_env = np.zeros(len(data))
    for i in range(n_frames):
        s = i * hop
        e = s + frame
        rms = np.sqrt(np.mean(low_mid[s:e] ** 2))
        rms_env[s:e] = np.maximum(rms_env[s:e], rms)

    # Smooth envelope
    smoothing = max(1, int(rate * 0.01))
    kernel = np.ones(smoothing) / smoothing
    for ch in range(data.shape[1]):
        pass
    env_smooth = np.convolve(rms_env, kernel, mode='same')

    # Detect transients (frames where level rises quickly)
    diff = np.diff(env_smooth, prepend=env_smooth[0])
    transient_mask = (diff > np.percentile(diff[diff > 0], 75)) if np.any(diff > 0) else np.zeros_like(diff, dtype=bool)

    # Apply gentle boost on transients (max +2 dB)
    boost = np.where(transient_mask, 1.26, 1.0)  # 2 dB ≈ 1.26x
    smooth_boost = np.convolve(boost, np.ones(smoothing) / smoothing, mode='same')
    smooth_boost = np.clip(smooth_boost, 1.0, 1.26)
    return data * smooth_boost[:, np.newaxis]


# ──────────────────────────────────────────────────────────────────────────────
# Stereo width
# ──────────────────────────────────────────────────────────────────────────────

def apply_stereo_enhancement(data: 'np.ndarray', preset: str,
                              custom_width: float | None = None) -> 'np.ndarray':
    """Mid-side stereo width enhancement."""
    import numpy as np

    if custom_width is not None:
        # custom_width is 50-200 (percent) → factor 0.5-2.0
        width_factor = custom_width / 100.0
    else:
        width_factor = {
            "streaming": 1.1,
            "club":      1.25,
            "warm_vinyl":1.05,
            "broadcast": 1.0,
            "custom":    1.1,
        }.get(preset, 1.1)

    if data.shape[1] >= 2:
        mid  = (data[:, 0] + data[:, 1]) / 2
        side = (data[:, 0] - data[:, 1]) / 2
        side_enhanced = side * width_factor
        data = data.copy()
        data[:, 0] = mid + side_enhanced
        data[:, 1] = mid - side_enhanced

    return data


# ──────────────────────────────────────────────────────────────────────────────
# Limiter
# ──────────────────────────────────────────────────────────────────────────────

def apply_limiter(data: 'np.ndarray', ceiling: float = -0.1) -> 'np.ndarray':
    """Brickwall true-peak limiter."""
    import numpy as np
    ceiling_linear = 10 ** (ceiling / 20)
    peak = np.max(np.abs(data))
    if peak > ceiling_linear:
        data = data * (ceiling_linear / peak)
    return data


# ──────────────────────────────────────────────────────────────────────────────
# Progress
# ──────────────────────────────────────────────────────────────────────────────

def report_progress(progress: int) -> None:
    print(json.dumps({"type": "progress", "progress": progress}), flush=True)


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({
            "error": "Usage: audioMastering.py <input> <output> <preset> <target_lufs> [custom_json]"
        }))
        sys.exit(1)

    input_path  = sys.argv[1]
    output_path = sys.argv[2]
    preset      = sys.argv[3]
    target_lufs = float(sys.argv[4])
    custom      = json.loads(sys.argv[5]) if len(sys.argv) >= 6 else {}

    try:
        result = process_audio(input_path, output_path, preset, target_lufs, custom)
        print(json.dumps({"type": "result", **result}), flush=True)
    except Exception as e:
        print(json.dumps({
            "type": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }), flush=True)
        sys.exit(1)
