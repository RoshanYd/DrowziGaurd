"""
DrowsiGuard — ONNX Export & Quantization
==========================================
Converts the trained PyTorch LSTM checkpoint to ONNX format and applies
quantization for efficient browser-side inference via onnxruntime-web.

Input:  ml-pipeline/models/drowsiness_lstm.pth
Output: ml-pipeline/models/drowsiness_lstm.onnx (quantized)
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Set utf-8 stdout encoding for Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import torch
import torch.nn as nn
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType
import onnxruntime as ort


# ── Re-import model architecture (must match train_lstm.py) ──

class DrowsinessLSTM(nn.Module):
    """Mirror of the model defined in train_lstm.py."""

    def __init__(
        self,
        input_size: int = 2,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.3,
        bidirectional: bool = True,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.num_directions = 2 if bidirectional else 1

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=bidirectional,
        )

        lstm_output_size = hidden_size * self.num_directions

        self.attention = nn.Sequential(
            nn.Linear(lstm_output_size, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
        )

        self.classifier = nn.Sequential(
            nn.Linear(lstm_output_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(dropout / 2),
            nn.Linear(32, 1),
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        attn_weights = self.attention(lstm_out)
        attn_weights = torch.softmax(attn_weights, dim=1)
        context = torch.sum(attn_weights * lstm_out, dim=1)
        logit = self.classifier(context)
        return logit


class DrowsinessLSTMExport(nn.Module):
    """
    Wrapper that applies sigmoid to the output for ONNX export,
    so the browser receives a [0, 1] probability directly.
    """

    def __init__(self, model: DrowsinessLSTM):
        super().__init__()
        self.model = model

    def forward(self, x):
        logit = self.model(x)
        prob = torch.sigmoid(logit)
        return prob


def export_to_onnx(checkpoint_path: Path, output_dir: Path):
    """Export PyTorch model to ONNX format."""
    print("\n  📦 Loading checkpoint...")
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    config = checkpoint["config"]

    print(f"  Model config: {json.dumps(config, indent=4)}")

    # Rebuild model
    model = DrowsinessLSTM(
        input_size=config["input_size"],
        hidden_size=config["hidden_size"],
        num_layers=config["num_layers"],
        dropout=config["dropout"],
        bidirectional=config["bidirectional"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Wrap with sigmoid output
    export_model = DrowsinessLSTMExport(model)
    export_model.eval()

    # Create dummy input matching expected shape
    seq_len = config["seq_len"]
    input_size = config["input_size"]
    dummy_input = torch.randn(1, seq_len, input_size)

    onnx_path = output_dir / "drowsiness_lstm_fp32.onnx"
    quantized_path = output_dir / "drowsiness_lstm.onnx"

    print(f"\n  🔄 Exporting to ONNX (FP32)...")
    print(f"     Input shape: (1, {seq_len}, {input_size})")

    torch.onnx.export(
        export_model,
        dummy_input,
        str(onnx_path),
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "output": {0: "batch_size"},
        },
        dynamo=False,
    )

    # Validate ONNX model
    onnx_model = onnx.load(str(onnx_path))
    onnx.checker.check_model(onnx_model)
    print(f"  ✅ ONNX model validated: {onnx_path}")

    fp32_size = os.path.getsize(onnx_path) / 1024
    print(f"     FP32 size: {fp32_size:.1f} KB")

    # ── Dynamic Quantization (int8) ──
    print(f"\n  🔄 Applying int8 dynamic quantization...")
    quantize_dynamic(
        str(onnx_path),
        str(quantized_path),
        weight_type=QuantType.QUInt8,
    )

    quant_size = os.path.getsize(quantized_path) / 1024
    compression = (1 - quant_size / fp32_size) * 100
    print(f"  ✅ Quantized model saved: {quantized_path}")
    print(f"     Quantized size: {quant_size:.1f} KB ({compression:.1f}% compression)")

    # ── Verify Quantized Model ──
    print(f"\n  🔍 Verifying quantized model output...")
    session = ort.InferenceSession(str(quantized_path))
    test_input = np.random.randn(1, seq_len, input_size).astype(np.float32)

    ort_output = session.run(None, {"input": test_input})[0]
    print(f"     Test output shape: {ort_output.shape}")
    print(f"     Test output value: {ort_output[0][0]:.6f}")
    print(f"     Output range: [0, 1] ✅" if 0 <= ort_output[0][0] <= 1 else "     Output range: unexpected ⚠")

    # ── Also verify FP32 vs Quantized consistency ──
    session_fp32 = ort.InferenceSession(str(onnx_path))
    fp32_output = session_fp32.run(None, {"input": test_input})[0]
    diff = abs(fp32_output[0][0] - ort_output[0][0])
    print(f"     FP32 vs Quantized diff: {diff:.6f}")

    # Clean up FP32 model (keep only quantized)
    os.remove(onnx_path)
    print(f"     Cleaned up FP32 model (keeping quantized only)")

    # ── Save inference metadata ──
    inference_meta = {
        "model_file": "drowsiness_lstm.onnx",
        "input_name": "input",
        "output_name": "output",
        "input_shape": [1, seq_len, input_size],
        "features": config["features"],
        "feature_mean": config["feature_mean"],
        "feature_std": config["feature_std"],
        "seq_len": seq_len,
        "threshold": 0.5,
        "labels": {0: "alert", 1: "drowsy"},
    }
    meta_path = output_dir / "inference_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(inference_meta, f, indent=2)

    print(f"\n  ✅ Inference metadata saved → {meta_path}")


def main():
    parser = argparse.ArgumentParser(description="DrowsiGuard ONNX Export")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=str(Path(__file__).resolve().parent / "models" / "drowsiness_lstm.pth"),
        help="Path to PyTorch checkpoint",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(Path(__file__).resolve().parent / "models"),
        help="Output directory for ONNX model",
    )
    args = parser.parse_args()

    checkpoint_path = Path(args.checkpoint)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("  DrowsiGuard — ONNX Export & Quantization")
    print("=" * 70)
    print(f"  Checkpoint : {checkpoint_path}")
    print(f"  Output Dir : {output_dir}")
    print("=" * 70)

    if not checkpoint_path.exists():
        print(f"\n  ❌ Checkpoint not found: {checkpoint_path}")
        print("  → Run train_lstm.py first!")
        return

    export_to_onnx(checkpoint_path, output_dir)

    print(f"\n{'=' * 70}")
    print("  ✅ ONNX export complete!")
    print("  → Copy drowsiness_lstm.onnx to apps/web/public/models/")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
