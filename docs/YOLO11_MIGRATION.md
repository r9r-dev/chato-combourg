# Migration vers YOLO11 - Documentation

## Contexte

Migration du système de détection de cartes de l'architecture multi-étapes (YOLO binaire + CLIP + Template Matching + Claude fallback) vers YOLO11 avec 92 classes (une par carte).

### Sources d'inspiration
- Paper Stanford CS231n : "Real-Time Pokemon Card Detection from Tournament Footage" (Edwin Pua)
- Documentation Ultralytics YOLO11

## Ce qui a été fait

### 1. Générateur de dataset synthétique

**Fichier** : `training/generate_dataset.py`

**Caractéristiques** :
- Format portrait 3:4 (960x1280) comme les photos de téléphone
- 92 classes (une par carte)
- Grille 3x3 très serrée (gap 2-8px, marge 5px)

**Augmentations implémentées** :

| Catégorie | Technique | Paramètres |
|-----------|-----------|------------|
| Géométrie | Rotation | -10° à +10° |
| | Scale | 0.92x à 1.08x |
| | Perspective (trapèze) | 70% des images, force 2-6% |
| Couleur | HSV hue/sat/brightness | Variations réalistes |
| | Contraste | 0.8 à 1.2 |
| Dégradation | Flou gaussien | 30% des images |
| | Bruit gaussien | 40% des images |
| | Compression JPEG | 30%, qualité 70-95 |
| | Basse résolution | 30%, simule vieux téléphones |
| Occlusions | Cartes aux bords coupées | 15%, 3-15% coupé |
| | Chevauchement entre cartes | 30%, 5-15% overlap |
| | Occlusion externe (main) | 6% |
| Dommages cartes | Taches (café/vin) | 20% des cartes |
| | Coins arrachés | |
| | Usure | |
| | Rayures | |
| Éclairage | Reflets/glare global | 15%, depuis coins/bords/centre |
| Fonds | Textures bois | 30% (clair et sombre) |
| | Tissu/nappe | 30% |
| | Tapis | 20% |
| | Motifs (carreaux, rayures) | 10% |
| | Couleur unie | 10% |
| | Fonds clairs (blanc/gris/beige) | 25% de tous les fonds |

### 2. Dataset généré

```
training/dataset/
├── images/
│   ├── train/    # 5000 images
│   └── val/      # 500 images (synthétiques)
├── labels/
│   ├── train/    # Annotations YOLO format
│   └── val/
└── data.yaml     # Config YOLO (92 classes)
```

**Format annotations YOLO** : `class_id x_center y_center width height` (normalisé 0-1)

### 3. Script d'entraînement YOLO11

**Fichier** : `training/train.py`

Script complet avec :
- Modèle par défaut : yolo11l (25M params, mAP 53.4%)
- 100 epochs avec early stopping (patience=50)
- Hyperparamètres optimisés pour fine-tuning (lr0=0.001, AdamW, cosine LR)
- Augmentations YOLO natives légères (mosaic, mixup, HSV) complémentaires au dataset
- Support MPS (Apple Silicon)
- Options : `--resume`, `--export`, `--epochs`, `--batch`

### 4. Migration du backend (FAIT)

**Fichiers supprimés** :
- `clip_matcher.py` (136 lignes)
- `template_matcher.py` (277 lignes)
- `attribute_matcher.py` (235 lignes)
- `claude_fallback.py` (249 lignes)
- `feature_extractor.py`
- `grid_detector.py`

**Dépendances supprimées** :
- CLIP (git+https://github.com/openai/CLIP.git)
- anthropic
- rembg
- opencv-python-headless (ultralytics l'installe comme dépendance)

**Nouveau pipeline** :
```
Photo (upload)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  YOLO11 - 92 classes                                        │
│  → Détection + Identification en une passe                  │
│  → Retourne bboxes + class_id + confidence                  │
│  → Sélection des 9 meilleures cartes par zone               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Post-processing                                            │
│  → Assigne positions grid (row, col)                        │
│  → Convertit class_id en card_id ("001"-"092")              │
│  → Formate réponse API                                      │
└─────────────────────────────────────────────────────────────┘
```

### 5. Algorithme de sélection des 9 cartes

Quand YOLO détecte plus de 9 cartes (fausses détections), l'algorithme :

1. Calcule les bounds de la grille à partir des détections
2. Assigne chaque détection à une zone (row, col) de la grille 3x3
3. Pour chaque zone, garde la détection avec la confidence la plus haute
4. Retourne exactement 9 cartes (ou moins si pas assez détectées)

Cela permet de filtrer les fausses détections tout en gardant les bonnes identifications même avec une confidence faible.

## Commandes utiles

```bash
cd /Users/rlamour/Developer/code/perso/chato-combourg
source training/.venv/bin/activate

# Générer le dataset
python training/generate_dataset.py --train 5000 --val 500

# Entraîner YOLO11
python training/train.py

# Entraînement rapide (test)
python training/train.py --epochs 10

# Reprendre un entraînement
python training/train.py --resume

# Exporter en ONNX
python training/train.py --export
```

## Structure du modèle

Le modèle entraîné se trouve dans :
```
backend/models/card_detector/weights/best.pt
```

## Notes importantes

- Les cartes PNG source sont dans `backend/cards/carte_*.png` (630x880px)
- Le fichier `backend/cards/cards.json` contient les 92 noms de cartes
- Le mapping class_id ↔ card_id : `card_id = f"{class_id + 1:03d}"`
- Format de sortie API conservé pour compatibilité frontend
