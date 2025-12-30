#!/usr/bin/env python3
"""
Test du modèle YOLO11x sur les photos réelles via le nouveau détecteur.

Usage:
    python test_on_real_photos.py
"""

import sys
from pathlib import Path

# Add backend to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from PIL import Image
from app.services.yolo_detector import yolo_detector

PICS_DIR = PROJECT_ROOT / "pics"


def main():
    # Trouver les photos
    photos = list(PICS_DIR.glob("*.jpg")) + list(PICS_DIR.glob("*.jpeg")) + list(PICS_DIR.glob("*.png")) + list(PICS_DIR.glob("*.HEIC"))
    if not photos:
        print(f"Erreur: Aucune photo trouvée dans {PICS_DIR}")
        return 1

    print(f"Photos trouvées: {len(photos)}")
    print()

    # Statistiques
    total_photos = 0
    photos_with_9_cards = 0
    total_high_conf = 0
    total_medium_conf = 0
    total_low_conf = 0

    for photo in sorted(photos):
        print(f"\n{'='*60}")
        print(f"Photo: {photo.name}")
        print('='*60)

        # Charger l'image avec correction d'orientation EXIF
        try:
            from app.services.image_processor import correct_orientation
            image = Image.open(photo)
            image = correct_orientation(image)
            if image.mode != 'RGB':
                image = image.convert('RGB')
        except Exception as e:
            print(f"  Erreur chargement: {e}")
            continue

        total_photos += 1

        # Détecter avec le nouveau détecteur
        detections = yolo_detector.detect_cards(image, confidence=0.5)

        num_cards = len(detections)
        print(f"Cartes détectées: {num_cards}")

        if num_cards == 9:
            photos_with_9_cards += 1

        if num_cards == 0:
            print("  Aucune carte détectée!")
            continue

        print()

        # Afficher chaque détection
        for i, det in enumerate(detections):
            class_name = det["class_name"]
            confidence = det["confidence"]
            position = det.get("position", (0, 0))

            # Catégoriser la confiance
            if confidence >= 0.9:
                conf_marker = "+++"
                total_high_conf += 1
            elif confidence >= 0.7:
                conf_marker = "++"
                total_medium_conf += 1
            else:
                conf_marker = "+"
                total_low_conf += 1

            pos_str = f"[{position[0]},{position[1]}]"
            print(f"  {i+1}. {pos_str} {class_name:25} {confidence*100:5.1f}% {conf_marker}")

    # Résumé
    print(f"\n{'='*60}")
    print("RÉSUMÉ")
    print('='*60)
    print(f"Photos analysées: {total_photos}")
    print(f"Photos avec exactement 9 cartes: {photos_with_9_cards}/{total_photos} ({100*photos_with_9_cards/total_photos:.0f}%)")
    print(f"\nConfiance des détections:")
    total_det = total_high_conf + total_medium_conf + total_low_conf
    print(f"  - Haute (>90%):   {total_high_conf} ({100*total_high_conf/total_det:.0f}%)")
    print(f"  - Moyenne (70-90%): {total_medium_conf} ({100*total_medium_conf/total_det:.0f}%)")
    print(f"  - Basse (<70%):   {total_low_conf} ({100*total_low_conf/total_det:.0f}%)")

    return 0


if __name__ == "__main__":
    exit(main())
