# Chato Combourg - Card Recognition

Application de reconnaissance de cartes de jeu a partir de photos.

## Fonctionnalites

- Analyse de photos de 9 cartes disposees en grille 3x3
- Correction automatique de l'orientation (EXIF)
- Detection automatique des contours des cartes
- Identification par similarite d'image (CLIP)
- Fallback sur Claude Vision si confiance insuffisante
- API REST pour integration

## Structure

- `backend/` - API de reconnaissance (Python/FastAPI)
- `tests/` - Tests du projet

## Documentation

Voir `backend/CLAUDE.md` pour les details techniques du backend.

## Demarrage rapide

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editer .env avec votre ANTHROPIC_API_KEY
python -m uvicorn app.main:app --port 8080
```

## API

```bash
# Health check
curl http://localhost:8080/api/health

# Liste des cartes
curl http://localhost:8080/api/cards

# Analyser une photo
curl -X POST http://localhost:8080/api/analyze -F photo=@ma_photo.jpg
```
