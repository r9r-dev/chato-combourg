#!/usr/bin/env python3
"""Génère les miniatures WebP des cartes PNG."""

from pathlib import Path

from PIL import Image

CARDS_DIR = Path(__file__).parent.parent / "cards"
THUMBS_DIR = CARDS_DIR / "thumbs"
THUMB_SIZE = (200, 280)


def generate_thumbs():
    """Génère les miniatures WebP pour toutes les cartes PNG."""
    THUMBS_DIR.mkdir(exist_ok=True)

    png_files = sorted(CARDS_DIR.glob("carte_*.png"))

    if not png_files:
        print(f"Aucune carte trouvée dans {CARDS_DIR}")
        return

    print(f"Génération des miniatures pour {len(png_files)} cartes...")

    for png_path in png_files:
        webp_path = THUMBS_DIR / f"{png_path.stem}.webp"

        with Image.open(png_path) as img:
            img.thumbnail(THUMB_SIZE, Image.Resampling.LANCZOS)
            img.save(webp_path, "WEBP", quality=85)

        print(f"  {png_path.name} -> {webp_path.name}")

    print(f"Terminé. {len(png_files)} miniatures générées dans {THUMBS_DIR}")


if __name__ == "__main__":
    generate_thumbs()
