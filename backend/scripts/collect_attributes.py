#!/usr/bin/env python3
"""
Script to collect missing card attributes interactively.
Shows each card image in a separate window (same window updates).

Single keypress input (no Enter needed):
- category: v=village, c=castle, n=none
- price_reduction: y=yes, n=no
- lock: y=yes, n=no
- max_coins: 0-9

Note: has_coin_purse is automatically set based on max_coins > 0
"""

import json
import sys
import termios
import tty
from pathlib import Path

import matplotlib.image as mpimg
import matplotlib.pyplot as plt

CARDS_DIR = Path(__file__).parent.parent / "cards"
ATTRIBUTES_FILE = CARDS_DIR / "card_attributes.json"
OUTPUT_FILE = Path(__file__).parent / "new_attributes.json"

# Global figure and axes for reuse
fig = None
ax = None
img_display = None


def getch():
    """Read a single character without requiring Enter."""
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    return ch


def init_viewer():
    """Initialize the matplotlib viewer window."""
    global fig, ax, img_display
    plt.ion()  # Interactive mode
    fig, ax = plt.subplots(figsize=(4, 6))
    ax.axis("off")
    fig.tight_layout()
    plt.show(block=False)


def show_card(card_id: str):
    """Display card image in the viewer window."""
    global fig, ax, img_display

    image_path = CARDS_DIR / f"carte_{card_id}.png"
    if not image_path.exists():
        print(f"Image not found: {image_path}")
        return

    img = mpimg.imread(str(image_path))

    ax.clear()
    ax.imshow(img)
    ax.axis("off")
    ax.set_title(f"Card {card_id}", fontsize=14, fontweight="bold")
    fig.canvas.draw()
    fig.canvas.flush_events()


def load_existing_attributes():
    with open(ATTRIBUTES_FILE) as f:
        return json.load(f)


def collect_attributes():
    existing = load_existing_attributes()
    results = {}

    # Check for existing progress
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE) as f:
            results = json.load(f)

    card_ids = sorted(existing.keys())

    # Initialize viewer
    init_viewer()

    print("\n=== Card Attribute Collector ===")
    print("Single keypress (no Enter needed)")
    print("Ctrl+C to stop and save progress\n")

    for card_id in card_ids:
        if card_id in results:
            continue

        # Show card image
        show_card(card_id)

        print(f"\n--- Card {card_id} ---")

        # Category
        print("Category [v=village / c=castle / n=none]: ", end="", flush=True)
        while True:
            ch = getch().lower()
            if ch in ("v", "c", "n"):
                break
            if ch == "\x03":  # Ctrl+C
                raise KeyboardInterrupt
        category = {"v": "village", "c": "castle"}.get(ch)
        print(ch)

        # Price reduction
        print("Price reduction [y/n]: ", end="", flush=True)
        while True:
            ch = getch().lower()
            if ch in ("y", "n"):
                break
            if ch == "\x03":
                raise KeyboardInterrupt
        has_price_reduction = ch == "y"
        print(ch)

        # Lock
        print("Lock [y/n]: ", end="", flush=True)
        while True:
            ch = getch().lower()
            if ch in ("y", "n"):
                break
            if ch == "\x03":
                raise KeyboardInterrupt
        has_lock = ch == "y"
        print(ch)

        # Max coins
        print("Max coins [0-9]: ", end="", flush=True)
        while True:
            ch = getch()
            if ch.isdigit():
                break
            if ch == "\x03":
                raise KeyboardInterrupt
        max_coins = int(ch)
        print(ch)

        # Store result
        results[card_id] = {
            **existing[card_id],
            "category": category,
            "has_price_reduction": has_price_reduction,
            "has_lock": has_lock,
            "has_coin_purse": max_coins > 0,
            "max_coins": max_coins,
        }

        # Save progress after each card
        with open(OUTPUT_FILE, "w") as f:
            json.dump(results, f, indent=2)

        print(f"Saved ({len(results)}/92)")

    plt.close(fig)
    print(f"\nDone! Results saved to {OUTPUT_FILE}")
    return results


if __name__ == "__main__":
    try:
        collect_attributes()
    except KeyboardInterrupt:
        print("\n\nProgress saved. Run again to resume.")
        plt.close("all")
        sys.exit(0)
