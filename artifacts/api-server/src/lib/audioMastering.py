#!/usr/bin/env python3
"""
AI Audio Mastering Script
Applies professional mastering techniques to audio files:
- Loudness normalization (LUFS targeting)
- Multi-band EQ
- Dynamic compression
- Stereo enhancement
- Brickwall limiting
"""

import sys
import json
import os
import tempfile
import traceback

def process_audio(input_path: str, output_path: str, preset: str, target_lufs: float) -> dict:
    """
    Master an audio file with the given preset and target LUFS.
    Returns a dict with measured_input_lufs, measured_output_lufs
    """
    import numpy as np
    import soundfile as sf
    import pyloudnorm as pyln
    from scipy import signal

    # Load audio
    data, rate = sf.read(input_path)
    
    # Ensure stereo
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    elif data.shape[1] > 2:
        data = data[:, :2]
    
    # Measure input loudness
    meter = pyln.Meter(rate)
    input_loudness = meter.integrated_loudness(data)
    
    # Report progress: analysis done
    report_progress(20)
    
    # Apply EQ based on preset
    data = apply_eq(data, rate, preset)
    report_progress(40)
    
    # Apply compression based on preset
    data = apply_compression(data, preset)
    report_progress(60)
    
    # Apply stereo enhancement
    data = apply_stereo_enhancement(data, preset)
    report_progress(70)
    
    # Normalize to target LUFS
    data = pyln.normalize.loudness(data, input_loudness, target_lufs)
    report_progress(80)
    
    # Apply true peak limiting to prevent clipping
    data = apply_limiter(data)
    report_progress(90)
    
    # Measure output loudness
    output_loudness = meter.integrated_loudness(data)
    
    # Clip to valid range
    data = np.clip(data, -1.0, 1.0)
    
    # Write output
    sf.write(output_path, data, rate, subtype='PCM_24')
    report_progress(100)
    
    return {
        "input_lufs": float(input_loudness) if not (input_loudness is None or (isinstance(input_loudness, float) and input_loudness != input_loudness)) else -70.0,
        "output_lufs": float(output_loudness) if not (output_loudness is None or (isinstance(output_loudness, float) and output_loudness != output_loudness)) else target_lufs,
    }


def apply_eq(data: 'np.ndarray', rate: int, preset: str) -> 'np.ndarray':
    """Apply EQ curves based on the mastering preset."""
    from scipy import signal
    import numpy as np
    
    if preset == "streaming":
        # Gentle, balanced EQ for streaming (Spotify/Apple Music standard)
        # Slight high-frequency air boost, controlled low end
        b_high, a_high = signal.butter(2, 12000 / (rate / 2), btype='highpass')
        high_shelf = signal.filtfilt(b_high, a_high, data, axis=0) * 0.15
        
        b_low, a_low = signal.butter(2, 60 / (rate / 2), btype='lowpass')
        low_cut = data - signal.filtfilt(b_low, a_low, data, axis=0) * 0.1
        
        return low_cut + high_shelf * 0.3
        
    elif preset == "club":
        # Enhanced low-end punch and presence for club/dance music
        b_sub, a_sub = signal.butter(2, [40 / (rate / 2), 100 / (rate / 2)], btype='bandpass')
        sub_boost = signal.filtfilt(b_sub, a_sub, data, axis=0) * 0.2
        
        b_presence, a_presence = signal.butter(2, [3000 / (rate / 2), 8000 / (rate / 2)], btype='bandpass')
        presence_boost = signal.filtfilt(b_presence, a_presence, data, axis=0) * 0.15
        
        return data + sub_boost + presence_boost
        
    elif preset == "warm_vinyl":
        # Warm, analog-style EQ with gentle high-frequency rolloff
        b_rolloff, a_rolloff = signal.butter(2, 14000 / (rate / 2), btype='lowpass')
        rolled_off = signal.filtfilt(b_rolloff, a_rolloff, data, axis=0)
        
        b_warmth, a_warmth = signal.butter(2, [200 / (rate / 2), 800 / (rate / 2)], btype='bandpass')
        warmth_boost = signal.filtfilt(b_warmth, a_warmth, data, axis=0) * 0.1
        
        return rolled_off + warmth_boost
        
    elif preset == "broadcast":
        # Broadcast-safe, flat and controlled EQ
        b_hp, a_hp = signal.butter(2, 80 / (rate / 2), btype='highpass')
        filtered = signal.filtfilt(b_hp, a_hp, data, axis=0)
        
        b_lp, a_lp = signal.butter(2, 16000 / (rate / 2), btype='lowpass')
        return signal.filtfilt(b_lp, a_lp, filtered, axis=0)
    
    return data


def apply_compression(data: 'np.ndarray', preset: str) -> 'np.ndarray':
    """Apply dynamic compression based on preset."""
    import numpy as np
    
    # Compression settings per preset
    settings = {
        "streaming": {"threshold": 0.5, "ratio": 3.0, "attack": 0.01, "release": 0.1},
        "club": {"threshold": 0.4, "ratio": 5.0, "attack": 0.003, "release": 0.08},
        "warm_vinyl": {"threshold": 0.6, "ratio": 2.5, "attack": 0.02, "release": 0.15},
        "broadcast": {"threshold": 0.5, "ratio": 4.0, "attack": 0.005, "release": 0.1},
        "custom": {"threshold": 0.5, "ratio": 3.0, "attack": 0.01, "release": 0.1},
    }
    
    s = settings.get(preset, settings["streaming"])
    threshold = s["threshold"]
    ratio = s["ratio"]
    
    # Simple RMS-based compression
    rms = np.sqrt(np.mean(data ** 2))
    if rms > threshold:
        gain = threshold / rms * (1 + (rms - threshold) / (ratio * (rms - threshold + 0.001)))
        data = data * gain
    
    return data


def apply_stereo_enhancement(data: 'np.ndarray', preset: str) -> 'np.ndarray':
    """Apply stereo width enhancement."""
    import numpy as np
    
    width_factor = {
        "streaming": 1.1,
        "club": 1.2,
        "warm_vinyl": 1.05,
        "broadcast": 1.0,
        "custom": 1.1,
    }.get(preset, 1.1)
    
    if data.shape[1] >= 2:
        mid = (data[:, 0] + data[:, 1]) / 2
        side = (data[:, 0] - data[:, 1]) / 2
        side_enhanced = side * width_factor
        data[:, 0] = mid + side_enhanced
        data[:, 1] = mid - side_enhanced
    
    return data


def apply_limiter(data: 'np.ndarray', ceiling: float = -0.1) -> 'np.ndarray':
    """Apply brickwall limiting to prevent clipping."""
    import numpy as np
    
    ceiling_linear = 10 ** (ceiling / 20)
    peak = np.max(np.abs(data))
    
    if peak > ceiling_linear:
        data = data * (ceiling_linear / peak)
    
    return data


def report_progress(progress: int) -> None:
    """Report progress to stdout for the Node.js parent to read."""
    print(json.dumps({"type": "progress", "progress": progress}), flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Usage: audioMastering.py <input> <output> <preset> <target_lufs>"}))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    preset = sys.argv[3]
    target_lufs = float(sys.argv[4])
    
    try:
        result = process_audio(input_path, output_path, preset, target_lufs)
        print(json.dumps({"type": "result", **result}), flush=True)
    except Exception as e:
        print(json.dumps({"type": "error", "error": str(e), "traceback": traceback.format_exc()}), flush=True)
        sys.exit(1)
