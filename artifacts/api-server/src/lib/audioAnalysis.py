#!/usr/bin/env python3
"""
Audio Analysis Engine v2 — librosa-powered

Measures acoustic properties used to drive the adaptive mastering engine.

CLI: python audioAnalysis.py <input_path>

Output (stdout): single JSON object with all measurements.
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
    """Return (spectral_centroid_hz, low_ratio, mid_ratio, high_ratio) via FFT."""
    mono = data.mean(axis=1)
    max_samples = int(rate * 30)
    if len(mono) > max_samples:
        mid = len(mono) // 2
        half = max_samples // 2
        mono = mono[mid - half:mid + half]

    n = len(mono)
    window = np.hanning(n)
    spectrum = np.abs(np.fft.rfft(mono * window))
    freqs = np.fft.rfftfreq(n, d=1.0 / rate)

    power = spectrum ** 2
    total_power = float(np.sum(power)) + 1e-12
    centroid = float(np.sum(freqs * power) / total_power)

    low_ratio = float(np.sum(power[freqs < 250])) / total_power
    mid_ratio = float(np.sum(power[(freqs >= 250) & (freqs < 4000)])) / total_power
    high_ratio = float(np.sum(power[freqs >= 4000])) / total_power

    return centroid, low_ratio, mid_ratio, high_ratio


def compute_stereo_width(data) -> float:
    """Stereo width via M/S. 0 = mono, 1 = fully decorrelated."""
    if data.shape[1] < 2:
        return 0.0
    mid = (data[:, 0] + data[:, 1]) / 2.0
    side = (data[:, 0] - data[:, 1]) / 2.0
    mid_rms = float(np.sqrt(np.mean(mid ** 2))) + 1e-9
    side_rms = float(np.sqrt(np.mean(side ** 2))) + 1e-9
    return float(np.clip(side_rms / (mid_rms + side_rms), 0.0, 1.0))


def compute_librosa_features(data, rate: int) -> dict:
    """
    Richer analysis using librosa:
      - tempo / BPM
      - sub-bass energy ratio (<80 Hz)
      - sibilance energy ratio (5–10 kHz) — high = likely harsh
      - spectral contrast (brightness discrimination)
      - zero crossing rate (speech vs music indicator)
      - genre_hint: 'afrobeats' | 'hiphop' | 'trap' | 'general'
    """
    try:
        import librosa

        mono = data.mean(axis=1).astype(np.float32)

        # Use up to 60 seconds from the middle for speed
        max_s = int(rate * 60)
        if len(mono) > max_s:
            mid = len(mono) // 2
            mono = mono[mid - max_s // 2: mid + max_s // 2]

        # --- Tempo ---
        try:
            tempo_arr, _ = librosa.beat.beat_track(y=mono, sr=rate)
            tempo = float(np.atleast_1d(tempo_arr)[0])
        except Exception:
            tempo = 0.0

        # --- STFT for band energy ---
        hop = 512
        n_fft = 2048
        S = np.abs(librosa.stft(mono, n_fft=n_fft, hop_length=hop)) ** 2
        freqs = librosa.fft_frequencies(sr=rate, n_fft=n_fft)
        total_e = float(S.sum()) + 1e-12

        sub_mask = freqs < 80
        sib_mask = (freqs >= 5000) & (freqs <= 10000)
        sub_ratio = float(S[sub_mask].sum()) / total_e
        sib_ratio = float(S[sib_mask].sum()) / total_e

        # --- Spectral contrast ---
        contrast = librosa.feature.spectral_contrast(S=S, sr=rate, n_fft=n_fft, hop_length=hop)
        mean_contrast = float(contrast.mean())

        # --- Zero crossing rate ---
        zcr = float(librosa.feature.zero_crossing_rate(mono, hop_length=hop).mean())

        # --- Naive genre hint ---
        # Trap: slow/fast BPM + very heavy sub, scooped mids
        # Hip-hop: moderate BPM + heavy sub, punchy
        # Afrobeats: 90-130 BPM, bright, moderate sub
        # General: everything else
        genre_hint = "general"
        if sub_ratio > 0.25 and tempo < 85:
            genre_hint = "trap"
        elif sub_ratio > 0.20 and 80 <= tempo <= 115:
            genre_hint = "hiphop"
        elif 90 <= tempo <= 135 and sib_ratio > 0.04:
            genre_hint = "afrobeats"
        elif sub_ratio > 0.18:
            genre_hint = "hiphop"

        return {
            "tempo_bpm": round(tempo, 1),
            "sub_bass_ratio": round(sub_ratio, 3),
            "sibilance_ratio": round(sib_ratio, 4),
            "spectral_contrast": round(mean_contrast, 2),
            "zero_crossing_rate": round(zcr, 4),
            "genre_hint": genre_hint,
        }

    except Exception as e:
        return {
            "tempo_bpm": 0.0,
            "sub_bass_ratio": 0.0,
            "sibilance_ratio": 0.0,
            "spectral_contrast": 0.0,
            "zero_crossing_rate": 0.0,
            "genre_hint": "general",
            "librosa_error": str(e),
        }


def analyze(input_path: str) -> dict:
    data, rate = load_audio(input_path)
    duration_sec = len(data) / rate

    integrated_lufs, lra = compute_loudness(data, rate)
    true_peak_dbfs, rms_db, crest_factor_db = compute_level_stats(data)
    spectral_centroid_hz, low_ratio, mid_ratio, high_ratio = compute_spectral_features(data, rate)
    stereo_width = compute_stereo_width(data)
    librosa_features = compute_librosa_features(data, rate)

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
        **librosa_features,
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
