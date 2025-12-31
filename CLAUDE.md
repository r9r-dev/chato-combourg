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
container run -p 8080:8080 -v ./data:/app/data -e DEV_MODE=true card-api

# Training (YOLO11)
cd training
source .venv/bin/activate
python train.py
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

#### Identification Pipeline (YOLO11)
Single-pass detection and identification using YOLO11 with 92 classes (one per card).

**File**: `app/services/yolo_detector.py`

**Flow**:
1. YOLO11 detects cards and identifies them in one pass
2. If >9 detections: compute grid bounds from top 9 by confidence only (avoids false positives affecting grid calculation)
3. Select best card per grid zone (highest confidence)
4. Convert class_id to card_id ("001"-"092")
5. Add 2 similar card suggestions per detection (same shields, category, cost)
6. Return API response with positions, confidence scores, and alternatives

**Similar Card Suggestions**: `find_similar_cards(card_id, limit=2)` returns cards with matching attributes (shield count > shield colors > category > cost).

**Training Data Capture**: Every `/api/analyze` request saves captures to `/app/data/captures/` for future model training. Each capture folder (named `YYYYMMDD_HHMMSS_microseconds`) contains: `original.jpg`, `annotated.jpg` (with bounding boxes), and `report.json` (detection details).

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
- **PNG originals** (`backend/cards/`) - 630x880px, used for YOLO training
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
- `Camera.tsx` - Camera with 3x3 grid overlay, 3-second countdown between scans, displays detection count, keeps best detection in memory for manual validation, handles device orientation via screen.orientation API
- `Summary.tsx` - Results with rankings, click to view player's board
- `Games.tsx` - Game history list

#### Contexts
- `AuthContext.tsx` - User authentication and player management
- `GameContext.tsx` - Game state (multi-player support)

#### Components
- `CardGrid.tsx` - 3x3 card display with scores, always shows 9 positions (empty slots display "?" and are clickable)
- `CardSelector.tsx` - Modal to replace card (3 suggestions: detected + 2 similar, plus search); opens search directly for empty positions
- `NumberPad.tsx` - Numeric keypad for keys/coins input
- `ConfirmDialog.tsx` - Confirmation modal
- `GridOverlay.tsx` - Camera grid overlay

### Training (training/)

YOLO11 training pipeline for card detection/identification.

- `generate_dataset.py` - Synthetic dataset generator with augmentations
- `train.py` - Training script with MPS support
- `dataset/` - Generated training data (5000 train, 500 val images)

## API Endpoints

### Card Recognition
- `POST /api/analyze` - Upload photo, returns identified cards with positions
- `POST /api/calculate` - Calculate score from 9 cards + keys + coins
- `GET /api/cards` - List all 92 reference cards

### Model (Offline Support)
- `GET /api/model/info` - List all ONNX variants with metadata
- `GET /api/model/info/{variant}` - Get specific variant info (fp32, fp16, int8)
- `GET /api/model/download?variant=fp16` - Download ONNX model for local inference
- `GET /api/model/classes` - List 92 class names

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
- `YOLO_CONFIDENCE_THRESHOLD` - Detection threshold (default: 0.3)
- `API_PORT` - Server port (default: 8080)
- `DEV_MODE` - Use fake user for development (default: false)
- `DEV_USER_ID`, `DEV_USER_EMAIL`, `DEV_USER_NAME` - Fake user details

## Git Rules

- **NEVER delete or modify existing tags** - Tags are immutable once pushed
- Create a new patch version (e.g., v1.3.1) for fixes instead of modifying v1.3.0

## Deployment

### Container Volumes
Required mounts:
- `/app/models` - YOLO model weights (read-only)
- `/app/deps` - Python dependencies cache (persisted for fast restarts)
- `/app/data` - SQLite database and captures

```bash
container run -v ./backend/models:/app/models:ro -v ./data:/app/data ...
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

## Offline Inference

Supports client-side card detection using ONNX Runtime Web.

### Settings
- `offline_mode` setting with 3 options:
  - `never` - Always use server (default)
  - `fallback` - Try server first, use local if unavailable
  - `always` - Always use local inference

### Model Variants
User can choose between 3 ONNX model variants:
- **FP32** (~218 MB) - Full precision, best quality
- **FP16** (~109 MB) - Half precision, recommended (same accuracy as FP32)
- **INT8** (~55 MB) - Quantized, smallest size, slightly reduced precision

### Model Files
- Source: `models/card_detector/weights/model.pt` (343 MB, 92 classes)
- ONNX exports: `backend/models/card_detector/onnx_{fp32,fp16,int8}/model.onnx`
- Export script: `backend/scripts/export_onnx.py` (supports `--half` for FP16, `--int8` for INT8)

### API Endpoints
- `GET /api/model/info` - Returns all variant info (sizes, hashes, availability)
- `GET /api/model/download?variant=fp16` - Download specific variant
- `GET /api/model/classes` - List 92 class names

### Frontend Services
- `modelStorage.ts` - IndexedDB storage for ONNX model (stores variant info)
- `localInference.ts` - ONNX Runtime Web inference pipeline

### Workflow
1. User selects model variant in Settings (FP32/FP16/INT8)
2. User downloads model (one-time per variant)
3. Model stored in IndexedDB with variant metadata
4. Camera.tsx checks offline_mode setting
5. If local: runs inference via localInference service
6. Results in same format as server API
