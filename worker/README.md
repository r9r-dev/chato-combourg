# PyTorch Worker

Micro-service d'inference YOLO pour Mac M4 avec application menu bar.

## Installation rapide (service macOS)

```bash
cd worker
./install.sh
```

Cela va :
- Creer un virtualenv et installer les dependances
- Installer le LaunchAgent pour demarrage automatique
- Lancer l'application menu bar

Une icone **W** apparait dans la barre de menu.

## Desinstallation

```bash
launchctl unload ~/Library/LaunchAgents/com.chato.worker.plist
rm ~/Library/LaunchAgents/com.chato.worker.plist
```

## Installation manuelle

```bash
cd worker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Lancement manuel (sans menu bar)

```bash
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 50100
```

### Lancement avec menu bar

```bash
source venv/bin/activate
python menubar_app.py
```

## Application Menu Bar

L'icone **W** dans la barre de menu permet de :
- Voir le statut du serveur (Running/Stopped)
- Demarrer/Arreter le serveur
- Ouvrir les logs
- Quitter l'application

## Configuration du serveur principal

Sur le serveur Docker, ajouter dans `.env` :

```env
PYTORCH_WORKER_URL=http://192.168.x.x:50100
PYTORCH_WORKER_TIMEOUT=10.0
```

Remplacer `192.168.x.x` par l'IP locale du Mac.

## Endpoints

### POST /infer

Upload une image et retourne les detections.

```bash
curl -X POST -F "image=@photo.jpg" http://localhost:50100/infer
```

Reponse :
```json
{
  "success": true,
  "cards": [
    {
      "class_id": 42,
      "class_name": "043",
      "bbox": [100, 200, 300, 400],
      "confidence": 0.95,
      "center": [200.0, 300.0],
      "position": [0, 0]
    }
  ],
  "inference_time_ms": 950.5,
  "device": "mps"
}
```

### GET /health

Verifie que le service est operationnel.

```bash
curl http://localhost:50100/health
```

Reponse :
```json
{
  "status": "ok",
  "model": "pytorch",
  "device": "mps",
  "model_loaded": true
}
```

## Logs

```bash
tail -f ~/Library/Logs/chato-worker.log
```

## Performance

| Plateforme | Temps d'inference |
|------------|-------------------|
| Mac M4 (MPS) | ~1s |
| Serveur Docker (CPU) | ~7s |
