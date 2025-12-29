# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chateau Combo scoring application with card recognition from photos and score calculation. Built with Python 3.12/FastAPI backend and React/TypeScript PWA frontend. Supports multi-player games with user accounts and game history.

## Commands

```bash
# Backend development
cd backend
source venv/bin/activate
DEV_MODE=true python -m uvicorn app.main:app --reload --port 8080

# Frontend development
cd frontend
npm run dev          # Dev server on port 5173
npm run build        # Build to dist/

# Run all tests
cd backend && pytest tests/

# Container (use 'container' instead of docker on this system)
container build -t card-api .
container run -p 8080:8080 -v ./data:/app/data -e ANTHROPIC_API_KEY=sk-... -e DEV_MODE=true card-api
```

## Architecture

### Backend (backend/)

#### Database (SQLite)
- Location: `backend/data/chato.db`
- Models in `app/database/models.py`:
  - `User` - Authenticated users (from Pangolin SSO)
  - `Player` - Player profiles (reusable across games)
  - `Game` - Game sessions with date and notes
  - `GamePlayer` - Player's board in a game (cards, score, rank)
  - `Setting` - User settings (key-value pairs)

#### Authentication (Pangolin Proxy)
- Headers read by `app/auth.py`:
  - `Remote-User` - User ID
  - `Remote-Email` - User email
  - `Remote-Name` - User display name
- DEV_MODE=true uses fake user for local development

#### Identification Pipeline
1. **YOLO** (`yolo_detector.py`) detects cards in the photo and assigns grid positions
2. **CLIP** (`clip_matcher.py`) identifies each card via embedding similarity
3. **Attribute detection** (`template_matcher.py`) detects value + shields
4. If CLIP hesitates: re-rank using attributes
5. If still low confidence: **Claude Vision** fallback

#### Calculator Engine (backend/app/services/calculator/)
- `models.py` - Pydantic models for request/response
- `grid.py` - Grid helper functions (row/col, shields, categories)
- `rules.py` - 92 card scoring rules (French explanations)
- `engine.py` - Main score calculation

#### Card Attributes (backend/cards/card_attributes.json)
- `value` - Card cost (0-8)
- `shields` - Array of {count, color}
- `category` - "village" | "castle" | null
- `has_price_reduction`, `has_lock`, `has_coin_purse`, `max_coins`

#### Card Images
- **PNG originals** (`backend/cards/`) - 630x880px, used for CLIP/YOLO recognition
- **WebP thumbnails** (`backend/cards/thumbs/`) - 200x280px, used for frontend display

### Frontend (frontend/)

React + Vite + TypeScript + Tailwind CSS PWA.

#### User Flow (Multi-player)
`Landing` -> `Players` -> `Keys` -> `Coins` -> `Camera` -> (repeat for each player) -> `Summary`

#### Pages
- `Landing.tsx` - Home screen with menu (Nouvelle partie, Mes parties, Parametres)
- `Players.tsx` - Player selection (2-5 players, create new players)
- `Keys.tsx` - Keys input with number pad (shows current player)
- `Coins.tsx` - Coins input with number pad (shows current player)
- `Camera.tsx` - Camera with 3x3 grid overlay, auto-capture every 2s
- `Summary.tsx` - Results with rankings, click to view player's board
- `Games.tsx` - Game history list

#### Contexts
- `AuthContext.tsx` - User authentication and player management
- `GameContext.tsx` - Game state (multi-player support)

#### Components
- `CardGrid.tsx` - 3x3 card display with scores
- `CardSelector.tsx` - Modal to replace card (6 suggestions + search)
- `NumberPad.tsx` - Numeric keypad for keys/coins input
- `ConfirmDialog.tsx` - Confirmation modal
- `GridOverlay.tsx` - Camera grid overlay

## API Endpoints

### Card Recognition
- `POST /api/analyze` - Upload photo, returns identified cards with positions
- `POST /api/calculate` - Calculate score from 9 cards + keys + coins
- `GET /api/cards` - List all 92 reference cards

### User & Players
- `GET /api/me` - Get current user profile
- `GET /api/players` - List user's players
- `POST /api/players` - Create a new player
- `DELETE /api/players/{id}` - Delete a player

### Games
- `GET /api/games` - List user's games (paginated)
- `GET /api/games/{id}` - Get game details with all player boards
- `POST /api/games` - Create a new game with player results
- `DELETE /api/games/{id}` - Delete a game

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

### System
- `GET /api/health` - Health check
- `GET /cards/{filename}` - Card images (static files)
- `GET /` - Serves PWA (when frontend/dist exists)

## Configuration

Environment variables in `.env`:
- `ANTHROPIC_API_KEY` - Required for Claude Vision fallback
- `CLIP_CONFIDENCE_THRESHOLD` - Threshold for fallback (default: 0.75)
- `API_PORT` - Server port (default: 8080)
- `DEV_MODE` - Use fake user for development (default: false)
- `DEV_USER_ID`, `DEV_USER_EMAIL`, `DEV_USER_NAME` - Fake user details

## Deployment

### Container Volume
Mount `/app/data` for SQLite database persistence:
```bash
container run -v ./data:/app/data ...
```

### Pangolin Proxy
The app expects to run behind Pangolin proxy which provides:
- SSO authentication (Google, Apple, etc.)
- Headers: `Remote-User`, `Remote-Email`, `Remote-Name`

## PWA

- Theme: Dark (#1a1a2e) with gold accents (#d4af37)
- Manifest and service worker auto-generated by vite-plugin-pwa
- Icons: `frontend/public/pwa-192x192.png`, `pwa-512x512.png`
- Requires HTTPS for camera access on iOS
