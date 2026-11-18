"""
DrowsiGuard — LSTM Model Training
===================================
Trains a PyTorch LSTM network on extracted EAR/MAR features for binary
drowsiness classification. Uses windowed sequences (simulating the
150-frame rolling buffer from real-time inference).

Since the dataset consists of individual images (not video sequences),
we create synthetic sequences using sliding windows with augmentation
to simulate temporal patterns.

Input:  ml-pipeline/data/features_{train,val,test}.csv
Output: ml-pipeline/models/drowsiness_lstm.pth
"""

import os
import sys
import argparse
import json
from pathlib import Path
from datetime import datetime

# Set utf-8 stdout encoding for Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)
from tqdm import tqdm
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


# ──────────────────────────── Configuration ────────────────────────────

DEFAULT_CONFIG = {
    "sequence_length": 30,    # Frames per sequence (reduced from 150 for image dataset)
    "features": ["ear_avg", "mar"],  # Input features
    "hidden_size": 64,
    "num_layers": 2,
    "dropout": 0.3,
    "bidirectional": True,
    "learning_rate": 1e-3,
    "weight_decay": 1e-4,
    "batch_size": 64,
    "epochs": 50,
    "patience": 10,  # Early stopping patience
}


# ──────────────────────────── Dataset ────────────────────────────

class DrowsinessSequenceDataset(Dataset):
    """
    Creates windowed sequences from per-image EAR/MAR features.
    
    Strategy:
    - Group images by class label
    - Create sliding windows of `seq_len` samples within each class
    - Apply light Gaussian noise augmentation for robustness
    """

    def __init__(self, csv_path: str, seq_len: int = 30, features: list = None, augment: bool = False):
        self.seq_len = seq_len
        self.features = features or ["ear_avg", "mar"]
        self.augment = augment

        df = pd.read_csv(csv_path)
        self.sequences = []
        self.labels = []

        for label in [0, 1]:
            class_data = df[df["label"] == label][self.features].values.astype(np.float32)
            
            if len(class_data) < seq_len:
                # Pad with repeats if insufficient data
                repeats = (seq_len // len(class_data)) + 1
                class_data = np.tile(class_data, (repeats, 1))[:seq_len]
                self.sequences.append(class_data)
                self.labels.append(label)
            else:
                # Sliding window with stride
                stride = max(1, seq_len // 4)
                for start in range(0, len(class_data) - seq_len + 1, stride):
                    seq = class_data[start : start + seq_len]
                    self.sequences.append(seq)
                    self.labels.append(label)

        self.sequences = np.array(self.sequences)
        self.labels = np.array(self.labels)

        # Compute and store normalization stats
        all_features = df[self.features].values.astype(np.float32)
        self.feature_mean = all_features.mean(axis=0)
        self.feature_std = all_features.std(axis=0) + 1e-8

        # Normalize sequences
        self.sequences = (self.sequences - self.feature_mean) / self.feature_std

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        seq = torch.tensor(self.sequences[idx], dtype=torch.float32)
        label = torch.tensor(self.labels[idx], dtype=torch.float32)

        if self.augment:
            # Light Gaussian noise for training augmentation
            noise = torch.randn_like(seq) * 0.02
            seq = seq + noise

        return seq, label


# ──────────────────────────── LSTM Model ────────────────────────────

class DrowsinessLSTM(nn.Module):
    """
    Bidirectional LSTM for binary drowsiness classification.
    
    Architecture:
    - Multi-layer bidirectional LSTM
    - Attention-weighted temporal aggregation
    - Fully connected classifier head
    
    Input shape:  (batch, seq_len, num_features)
    Output shape: (batch, 1)  — sigmoid probability
    """

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

        # LSTM encoder
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=bidirectional,
        )

        lstm_output_size = hidden_size * self.num_directions

        # Temporal attention layer
        self.attention = nn.Sequential(
            nn.Linear(lstm_output_size, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
        )

        # Classifier head
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
        # x shape: (batch, seq_len, features)
        lstm_out, _ = self.lstm(x)
        # lstm_out shape: (batch, seq_len, hidden_size * num_directions)

        # Attention weights
        attn_weights = self.attention(lstm_out)  # (batch, seq_len, 1)
        attn_weights = torch.softmax(attn_weights, dim=1)

        # Weighted sum of LSTM outputs
        context = torch.sum(attn_weights * lstm_out, dim=1)  # (batch, lstm_output_size)

        # Classify
        logit = self.classifier(context)  # (batch, 1)
        return logit


# ──────────────────────────── Training Loop ────────────────────────────

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0
    all_preds, all_labels = [], []

    for sequences, labels in loader:
        sequences = sequences.to(device)
        labels = labels.to(device).unsqueeze(1)

        optimizer.zero_grad()
        outputs = model(sequences)
        loss = criterion(outputs, labels)
        loss.backward()

        # Gradient clipping for LSTM stability
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

        optimizer.step()

        total_loss += loss.item() * sequences.size(0)
        preds = (torch.sigmoid(outputs) > 0.5).float()
        all_preds.extend(preds.cpu().numpy().flatten())
        all_labels.extend(labels.cpu().numpy().flatten())

    avg_loss = total_loss / len(loader.dataset)
    accuracy = accuracy_score(all_labels, all_preds)
    return avg_loss, accuracy


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    all_preds, all_labels = [], []

    with torch.no_grad():
        for sequences, labels in loader:
            sequences = sequences.to(device)
            labels = labels.to(device).unsqueeze(1)

            outputs = model(sequences)
            loss = criterion(outputs, labels)

            total_loss += loss.item() * sequences.size(0)
            preds = (torch.sigmoid(outputs) > 0.5).float()
            all_preds.extend(preds.cpu().numpy().flatten())
            all_labels.extend(labels.cpu().numpy().flatten())

    avg_loss = total_loss / len(loader.dataset)
    accuracy = accuracy_score(all_labels, all_preds)
    return avg_loss, accuracy, np.array(all_preds), np.array(all_labels)


# ──────────────────────────── Plotting ────────────────────────────

def plot_training_curves(train_losses, val_losses, train_accs, val_accs, output_dir):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Loss curves
    ax1.plot(train_losses, label="Train Loss", color="#FF6B6B", linewidth=2)
    ax1.plot(val_losses, label="Val Loss", color="#4ECDC4", linewidth=2)
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.set_title("Training & Validation Loss")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Accuracy curves
    ax2.plot(train_accs, label="Train Acc", color="#FF6B6B", linewidth=2)
    ax2.plot(val_accs, label="Val Acc", color="#4ECDC4", linewidth=2)
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Accuracy")
    ax2.set_title("Training & Validation Accuracy")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_dir / "training_curves.png", dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  📊 Training curves saved → {output_dir / 'training_curves.png'}")


# ──────────────────────────── Main ────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DrowsiGuard LSTM Training")
    parser.add_argument("--data-dir", type=str, default=str(Path(__file__).resolve().parent / "data"))
    parser.add_argument("--output-dir", type=str, default=str(Path(__file__).resolve().parent / "models"))
    parser.add_argument("--epochs", type=int, default=DEFAULT_CONFIG["epochs"])
    parser.add_argument("--batch-size", type=int, default=DEFAULT_CONFIG["batch_size"])
    parser.add_argument("--lr", type=float, default=DEFAULT_CONFIG["learning_rate"])
    parser.add_argument("--seq-len", type=int, default=DEFAULT_CONFIG["sequence_length"])
    parser.add_argument("--hidden-size", type=int, default=DEFAULT_CONFIG["hidden_size"])
    parser.add_argument("--num-layers", type=int, default=DEFAULT_CONFIG["num_layers"])
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print("=" * 70)
    print("  DrowsiGuard — LSTM Training Pipeline")
    print("=" * 70)
    print(f"  Device       : {device}")
    print(f"  Data Dir     : {data_dir}")
    print(f"  Output Dir   : {output_dir}")
    print(f"  Seq Length   : {args.seq_len}")
    print(f"  Hidden Size  : {args.hidden_size}")
    print(f"  Num Layers   : {args.num_layers}")
    print(f"  Batch Size   : {args.batch_size}")
    print(f"  Learning Rate: {args.lr}")
    print(f"  Epochs       : {args.epochs}")
    print("=" * 70)

    # ── Load Datasets ──
    print("\n  📂 Loading datasets...")

    train_csv = data_dir / "features_train.csv"
    val_csv = data_dir / "features_val.csv"
    test_csv = data_dir / "features_test.csv"

    for f in [train_csv, val_csv, test_csv]:
        if not f.exists():
            print(f"  ❌ Missing: {f}")
            print("  → Run extract_features.py first!")
            return

    features = DEFAULT_CONFIG["features"]
    train_dataset = DrowsinessSequenceDataset(train_csv, args.seq_len, features, augment=True)
    val_dataset = DrowsinessSequenceDataset(val_csv, args.seq_len, features, augment=False)
    test_dataset = DrowsinessSequenceDataset(test_csv, args.seq_len, features, augment=False)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, drop_last=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    print(f"  Train: {len(train_dataset)} sequences")
    print(f"  Val:   {len(val_dataset)} sequences")
    print(f"  Test:  {len(test_dataset)} sequences")

    # ── Initialize Model ──
    model = DrowsinessLSTM(
        input_size=len(features),
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        dropout=DEFAULT_CONFIG["dropout"],
        bidirectional=DEFAULT_CONFIG["bidirectional"],
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\n  🧠 Model Parameters: {total_params:,} total, {trainable_params:,} trainable")

    # ── Training Setup ──
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=DEFAULT_CONFIG["weight_decay"])
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5
    )

    # ── Training Loop ──
    best_val_loss = float("inf")
    patience_counter = 0
    train_losses, val_losses = [], []
    train_accs, val_accs = [], []

    print(f"\n{'─' * 70}")
    print(f"  {'Epoch':>5} │ {'Train Loss':>10} │ {'Train Acc':>9} │ {'Val Loss':>10} │ {'Val Acc':>9} │ {'LR':>10}")
    print(f"{'─' * 70}")

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc, _, _ = evaluate(model, val_loader, criterion, device)

        scheduler.step(val_loss)
        current_lr = optimizer.param_groups[0]["lr"]

        train_losses.append(train_loss)
        val_losses.append(val_loss)
        train_accs.append(train_acc)
        val_accs.append(val_acc)

        marker = ""
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            # Save best model
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": val_loss,
                "val_acc": val_acc,
                "config": {
                    "input_size": len(features),
                    "hidden_size": args.hidden_size,
                    "num_layers": args.num_layers,
                    "dropout": DEFAULT_CONFIG["dropout"],
                    "bidirectional": DEFAULT_CONFIG["bidirectional"],
                    "seq_len": args.seq_len,
                    "features": features,
                    "feature_mean": train_dataset.feature_mean.tolist(),
                    "feature_std": train_dataset.feature_std.tolist(),
                },
            }, output_dir / "drowsiness_lstm.pth")
            marker = " ★"
        else:
            patience_counter += 1

        print(
            f"  {epoch:>5} │ {train_loss:>10.4f} │ {train_acc:>8.1%} │ "
            f"{val_loss:>10.4f} │ {val_acc:>8.1%} │ {current_lr:>10.2e}{marker}"
        )

        if patience_counter >= DEFAULT_CONFIG["patience"]:
            print(f"\n  ⏹ Early stopping at epoch {epoch} (patience={DEFAULT_CONFIG['patience']})")
            break

    # ── Plot Training Curves ──
    plot_training_curves(train_losses, val_losses, train_accs, val_accs, output_dir)

    # ── Test Evaluation ──
    print(f"\n{'=' * 70}")
    print("  📊 Test Set Evaluation")
    print(f"{'=' * 70}")

    # Load best model
    checkpoint = torch.load(output_dir / "drowsiness_lstm.pth", map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])

    test_loss, test_acc, test_preds, test_labels = evaluate(model, test_loader, criterion, device)

    print(f"\n  Test Loss:     {test_loss:.4f}")
    print(f"  Test Accuracy: {test_acc:.1%}")
    print(f"\n  Precision: {precision_score(test_labels, test_preds):.4f}")
    print(f"  Recall:    {recall_score(test_labels, test_preds):.4f}")
    print(f"  F1 Score:  {f1_score(test_labels, test_preds):.4f}")
    print(f"\n  Confusion Matrix:")
    cm = confusion_matrix(test_labels, test_preds)
    print(f"    TN={int(cm[0][0]):>4}  FP={int(cm[0][1]):>4}")
    print(f"    FN={int(cm[1][0]):>4}  TP={int(cm[1][1]):>4}")
    print(f"\n  {classification_report(test_labels, test_preds, target_names=['Alert', 'Drowsy'])}")

    # Save normalization stats for inference
    norm_stats = {
        "feature_mean": train_dataset.feature_mean.tolist(),
        "feature_std": train_dataset.feature_std.tolist(),
        "features": features,
        "seq_len": args.seq_len,
    }
    with open(output_dir / "normalization_stats.json", "w") as f:
        json.dump(norm_stats, f, indent=2)

    print(f"  ✅ Best model saved → {output_dir / 'drowsiness_lstm.pth'}")
    print(f"  ✅ Norm stats saved → {output_dir / 'normalization_stats.json'}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
