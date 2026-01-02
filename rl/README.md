# Chateau Combo - IA Extreme (Reinforcement Learning)

Entraînement par renforcement d'une IA pour Château Combo utilisant MaskablePPO et self-play.

## Architecture

- **Framework**: Stable-Baselines3 + sb3-contrib (MaskablePPO)
- **Environnement**: Gymnasium custom
- **Réseau**: Transformer pour l'encodage des cartes
- **Entraînement**: Self-play avec pool d'adversaires

## Structure

```
rl/
├── chato_rl/
│   ├── game/           # Moteur de jeu Python (port du TypeScript)
│   ├── env/            # Environnement Gymnasium
│   ├── models/         # Architectures réseau (Transformer, policies)
│   ├── training/       # Self-play et callbacks
│   └── export/         # Export ONNX
├── scripts/            # Scripts d'entraînement
├── notebooks/          # Notebooks Colab
└── tests/              # Tests unitaires
```

## Installation

```bash
cd rl
python -m venv .venv
source .venv/bin/activate  # ou .venv/bin/activate.fish
pip install -e .
```

## Entraînement

### Local
```bash
python scripts/train.py --config configs/default.yaml
```

### Google Colab
Ouvrir `notebooks/train_colab.ipynb` dans Colab.

## Export

```bash
python scripts/export_onnx.py --checkpoint checkpoints/best_model.zip --output model.onnx
```
