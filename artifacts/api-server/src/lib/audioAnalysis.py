#!/usr/bin/env python3
"""
Fast audio analysis — measures acoustic properties without any DSP processing.
Used to give Claude real data about the uploaded track so AI suggestions are
grounded in actual measurements rather than guesswork.

CLI: python audioAnalysis.py <input_path>

Output (stdout): single JSON object
  {
    "integrated_lufs": float,     # ITU-R BS.1770 integrated loudness
    "loudness_range": float,      # LRA — dynamic range measure (dB)
    "true_peak_dbfs": float,      # absolute peak level in dBFS
    "rms_db": float,              # RMS level in dBFS
    "crest_factor_db": float,     # peak/RMS ratio (higher = more dynamic)
    "spectral_centroid_hz": float,# perceptual "brightness" center frequency
    "low_energy_ratio": float,    # fraction of energy below 250 Hz
    "mid_energy_ratio": float,    # fraction of energy 250–4000 Hz
    "high_energy_ratio": float,   # fraction of energy above 4000 Hz
    "stereo_width": float,        # 0 = mono, 1 = fully decorrelated stereo
    "duration_sec": float,        # track length in seconds
    "sample_rate": int,           # sample rate in Hz
  }
"""

import sys
import json
import os
import tempfile
import traceback

import numpy as np


def load_audio(input_path: str):
    import soundfile as sf

    ext = os.path.splitext(input_path)[1].lower()
    tmp_wav = None
    try:
        if ext in (".mp3", ".m4a", ".aac", ".ogg"):
            from pydub import AudioSegment
            seg = AudioSegment.from_file(input_path)
            tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp_wav.close()
            seg.export(tmp_wav.name, format="wav")
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


def compute_loudness(data, rate: int) -> tuple[float, float]:
    """Return (integrated_lufs, loudness_range) using pyloudnorm."""
    import pyloudnorm as pyln
    meter = pyln.Meter(rate)
    integrated = meter.integrated_loudness(data)
    if integrated is None or (isinstance(integrated, float) and integrated != integrated):
        integrated = -70.0

    # LRA: measure over 3-second blocks, take difference between high and low
    block_size = int(rate * 3.0)
    if block_size >= len(data):
        lra = 0.0
    else:
        short_meter = pyln.Meter(rate, block_size=0.4)
        lufs_values = []
        step = int(rate * 1.0)
        for start in range(0, len(data) - block_size, step):
            block = data[start:start + block_size]
            try:
                val = short_meter.integrated_loudness(block)
                if val is not None and not (isinstance(val, float) and val != val) and val > -70:
                    lufs_values.append(val)
            except Exception:
                pass
        if len(lufs_values) >= 4:
            lufs_values.sort()
            lo = np.percentile(lufs_values, 10)
            hi = np.percentile(lufs_values, 95)
            lra = max(0.0, float(hi - lo))
        else:
            lra = 0.0

    return float(integrated), float(lra)


def compute_level_stats(data) -> tuple[float, float, float]:
    """Return (true_peak_dbfs, rms_db, crest_factor_db)."""
    peak = float(np.max(np.abs(data)))
    true_peak_dbfs = 20.0 * np.log10(peak + 1e-9)

    rms = float(np.sqrt(np.mean(data ** 2)))
    rms_db = 20.0 * np.log10(rms + 1e-9)

    crest_factor_db = true_peak_dbfs - rms_db
    return true_peak_dbfs, rms_db, crest_factor_db


def compute_spectral_features(data, rate: int) -> tuple[float, float, float, float]:
    """Return (spectral_centroid_hz, low_ratio, mid_ratio, high_ratio).

    Uses a windowed FFT on the mono downmix. Analysis is done on up to 30s
    of audio (mid-section) for speed.
    """
    mono = data.mean(axis=1)

    # Sample up to 30 seconds from the middle of the track
    max_samples = int(rate * 30)
    if len(mono) > max_samples:
        mid = len(mono) // 2
        half = max_samples // 2
        mono = mono[mid - half:mid + half]

    # Hann-windowed FFT
    n = len(mono)
    window = np.hanning(n)
    spectrum = np.abs(np.fft.rfft(mono * window))
    freqs = np.fft.rfftfreq(n, d=1.0 / rate)

    power = spectrum ** 2
    total_power = float(np.sum(power)) + 1e-12

    # Spectral centroid
    centroid = float(np.sum(freqs * power) / total_power)

    # Band energy ratios
    low_mask = freqs < 250
    mid_mask = (freqs >= 250) & (freqs < 4000)
    high_mask = freqs >= 4000

    low_ratio = float(np.sum(power[low_mask])) / total_power
    mid_ratio = float(np.sum(power[mid_mask])) / total_power
    high_ratio = float(np.sum(power[high_mask])) / total_power

    return centroid, low_ratio, mid_ratio, high_ratio


def compute_stereo_width(data) -> float:
    """Stereo width via M/S analysis. 0 = mono, 1 = fully wide."""
    if data.shape[1] < 2:
        return 0.0
    mid = (data[:, 0] + data[:, 1]) / 2.0
    side = (data[:, 0] - data[:, 1]) / 2.0

    mid_rms = float(np.sqrt(np.mean(mid ** 2))) + 1e-9
    side_rms = float(np.sqrt(np.mean(side ** 2))) + 1e-9

    # Ratio of side energy to total energy — 0 at mono, ~1 at full stereo
    width = side_rms / (mid_rms + side_rms)
    return float(np.clip(width, 0.0, 1.0))


def analyze(input_path: str) -> dict:
    data, rate = load_audio(input_path)
    duration_sec = len(data) / rate

    integrated_lufs, lra = compute_loudness(data, rate)
    true_peak_dbfs, rms_db, crest_factor_db = compute_level_stats(data)
    spectral_centroid_hz, low_ratio, mid_ratio, high_ratio = compute_spectral_features(data, rate)
    stereo_width = compute_stereo_width(data)

    return {
        "integrated_lufs": round(integrated_lufs, 2),
        "loudness_range": round(lra, 2),
        "true_peak_dbfs": round(true_peak_dbfs, 2),
        "rms_db": round(rms_db, 2),
        "crest_factor_db": round(crest_factor_db, 2),
        "spectral_centroid_hz": round(spectral_centroid_hz, 1),
        "low_energy_ratio": round(low_ratio, 3),
        "mid_energy_ratio": round(mid_ratio, 3),
        "high_energy_ratio": round(high_ratio, 3),
        "stereo_width": round(stereo_width, 3),
        "duration_sec": round(duration_sec, 2),
        "sample_rate": rate,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: audioAnalysis.py <input_path>"}))
        sys.exit(1)

    try:
        result = analyze(sys.argv[1])
        print(json.dumps(result), flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}), flush=True)
        sys.exit(1)
