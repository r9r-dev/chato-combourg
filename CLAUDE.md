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
  - `Game` - Game sessions with date, notes, and source
  - `GamePlayer` - Player's board in a game (cards, score, rank)
  - `Setting` - User settings (key-value pairs)

**Game Sources** (`Game.source`):
- `scan` - Photo scan (default, card recognition)
- `legacy` - Manual import (scores without card identification)
- `application` - Play mode (vs AI)

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
- `rule_factories.py` - Factory functions for generating scoring rules
- `rules.py` - 92 card scoring rules (uses factories, French explanations)
- `engine.py` - Main score calculation

#### Error Handling (backend/app/)
- `exceptions.py` - Custom exception classes (AppException, ValidationError, NotFoundError, etc.)
- Global exception handlers in `main.py` for consistent JSON error responses
- Error format: `{ success: false, code: "ERROR_CODE", detail: "Message" }`

#### Business Logic (backend/app/)
- `queries.py` - Database query helpers with automatic 404 handling
- `services/game_service.py` - Game creation and rank calculation logic

#### Card Data (backend/cards/cards_data.json)
Unified JSON file containing all 92 cards with complete data:
- `id` - Card ID ("001"-"092")
- `name` - Card name (French)
- `file_name` - Image filename
- `value` - Card cost (0-8)
- `shields` - Array of {count, color}
- `category` - "village" | "castle" | null
- `has_messenger`, `has_price_reduction`, `has_lock`, `has_coin_purse`, `max_coins`
- `effects` - Array of effect objects (Play mode)
- `lock_effect` - Effect when using a key on the card's lock
- `scoring_rule` - Structured scoring rule for end-game calculation

**Centralized loader**: `app/services/card_data.py` provides cached access to all card data.

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
- `Changelog.tsx` - Release notes display (fetches CHANGELOG.md)

#### Contexts
- `AuthContext.tsx` - User authentication and player management
- `GameContext.tsx` - Game state (multi-player support, uses useReducer)
- `gameReducer.ts` - Typed actions and reducer for game state
- `useLegacyMode.ts` - Hook for legacy game import logic

#### Components
- `CardGrid.tsx` - 3x3 card display with scores, always shows 9 positions (empty slots display "?" and are clickable)
- `CardSelector.tsx` - Modal to replace card (3 suggestions: detected + 2 similar, plus search); opens search directly for empty positions
- `NumberPad.tsx` - Numeric keypad for keys/coins input
- `NumericInputPage.tsx` - Reusable page for numeric input (used by Keys and Coins)
- `PlayerBadge.tsx` - Colored circular badge for player identification
- `ConfirmDialog.tsx` - Confirmation modal
- `GridOverlay.tsx` - Camera grid overlay
- `ErrorBoundary.tsx` - React error boundary for graceful error handling
- `WhatsNew.tsx` - Modal showing latest changes on first launch after update

#### API Service (services/api.ts)
- `ApiError` class with status, code, and detail parsed from response
- All API functions use `handleApiError()` for consistent error handling
- French error messages for user-facing errors

#### Play Mode Services (services/play/)
Game engine for playing against AI.

**Game Saving:**
- Games are automatically saved when finished (source: `application`)
- Real scores calculated via `/api/calculate` endpoint
- AI players are created automatically if not existing (named "IA Facile", "IA Normale", etc.)

**Core Files:**
- `gameEngine.ts` - Game initialization, action validation, execution
- `effectExecutor.ts` - Executes card effects when placed

**Types** (`types/play.ts`):
- `PlayGameState` - Complete game state
- `PlayPlayer` - Player with board, resources, reductions
- `CentralBoard` - 2x3 cards + messenger + decks
- `GameAction` - Union of all action types
- Turn phases: `pre_action | buy | place | effect | post_action | end`

**AI Speed Setting** (`ai_speed`):
- `fast` - No delay between actions (default)
- `normal` - 2 seconds per action
- `slow` - 3 seconds per action

Configurable in Settings > Jeu > Vitesse de l'IA.

#### AI Architecture (services/play/ai/)

Modular AI system with 3 difficulty levels and pluggable algorithms.

**Directory Structure:**
```
ai/
├── index.ts              # Exports, SafeAIRunner wrapper, AI factory
├── types.ts              # Core type definitions
├── levels/               # AI implementations
│   ├── baseAI.ts         # Abstract base class (common methods, protection)
│   ├── easyAI.ts         # Beginner AI
│   ├── normalAI.ts       # Strategic AI
│   └── hardAI.ts         # Expert AI (MCTS)
├── algorithms/           # Decision algorithms
│   ├── mcts.ts           # Monte Carlo Tree Search (UCB1)
│   ├── greedy.ts         # Greedy selection
│   └── minimax.ts        # Minimax algorithm
├── evaluator/            # Scoring and evaluation
│   ├── scoreCalculator.ts # Complete 92-card score calculation
│   ├── scorer.ts         # State evaluation
│   ├── deltaCalculator.ts # Impact calculation
│   └── cache.ts          # Score caching
├── tree/                 # Decision tree operations
│   ├── generator.ts      # Build action trees
│   ├── traverser.ts      # Traverse trees
│   └── pruner.ts         # Prune trees
├── context/              # Context building
│   ├── builder.ts        # Constructs AIContext from game state
│   └── helpers.ts        # Helper functions
└── simulator/            # State simulation
    ├── executor.ts       # Execute actions
    ├── runner.ts         # Run simulations
    └── clone.ts          # Deep clone states
```

**AI Interface Methods:**
| Method | Type | Description |
|--------|------|-------------|
| `selectBuyAction` | Required | Choose card to buy |
| `selectPlaceAction` | Required | Choose placement position |
| `selectKeyAction` | Optional | Use key (move messenger/refresh) |
| `selectLockAction` | Optional | Open a lock |
| `selectEffectOption` | Effect | [OR] choice between options |
| `selectLocation` | Effect | Choose castle/village |
| `selectDiscardCard` | Effect | Choose card to discard |
| `selectAdjacentCard` | Effect | Choose adjacent card |
| `selectPurses` | Effect | Choose purses to fill |

**AI Levels:**

| Level | Strategy | Key Characteristics |
|-------|----------|---------------------|
| Easy | Naive | Picks from top 5 options, 70% ignores keys, 80% ignores locks, avoids complex cards |
| Normal | Heuristic | Synergy-aware, category/color matching, position quality evaluation |
| Hard | MCTS | 500 iterations, 3s timeout, UCB1 exploration, lookahead with delta calculation |

**MCTS Algorithm (Hard AI):**
- Selection: UCB1 formula with exploration constant sqrt(2)
- Returns action with most visits (more robust than highest average)
- Score caching for performance
- Pre-calculated placement positions during buy phase

**Protection Mechanisms:**
- `MAX_ITERATIONS = 100` in BaseAI (anti-infinite-loop)
- Hard AI: 500 iterations max + 3000ms timeout
- `SafeAIRunner` wrapper validates all actions with fallbacks

#### Simulation System (simulation/)

Standalone game engine for running simulations without UI.

**Files:**
- `engine.ts` - Game creation, action execution, effect handling
- `runner.ts` - Execute games, collect stats, load AI
- `types.ts` - SimConfig, SimGameResult, SimStats, TrainingData

**Key Types:**
```typescript
SimConfig {
  players: SimPlayerConfig[]  // name, type ('human_random'|'ai'), aiLevel
  seed?: number               // Reproducible randomness
  verbose?: boolean           // Show turn details
  collectTrainingData?: boolean
}

SimGameResult {
  gameId, seed, turns, durationMs
  players: SimPlayerResult[]  // name, type, score, gold, keys, cards, rank
  winnerIndex
}

SimStats {
  totalGames, winsByPlayer, avgScoreByPlayer, avgDurationMs, avgTurns
}
```

#### CLI Scripts (scripts/)

**Main Simulation CLI** (`simulate.ts`):
```bash
# Single game
npx tsx scripts/simulate.ts easy normal hard

# Multiple games with stats
npx tsx scripts/simulate.ts normal hard -n 100

# Verbose with reproducible seed
npx tsx scripts/simulate.ts hard hard -v -s 12345

# Collect training data
npx tsx scripts/simulate.ts normal normal -t

# JSON output
npx tsx scripts/simulate.ts hard hard --json > results.json
```

**Player Types:**
- `easy, e, facile` - Easy AI
- `normal, n, moyen` - Normal AI
- `hard, h, difficile` - Hard AI
- `random, r, humain` - Human random player

**Options:**
- `-n, --games N` - Number of games (default: 1)
- `-v, --verbose` - Show turn details
- `-s, --seed N` - Reproducible randomness
- `-t, --training` - Collect training data
- `--json` - JSON output

**Hard AI Benchmark** (`benchmark-hard-ai.ts`):
```bash
# Full benchmark (1000 games x 4 configs: 2P, 3P, 4P, 5P)
npx tsx scripts/benchmark-hard-ai.ts

# Smaller benchmark
npx tsx scripts/benchmark-hard-ai.ts --games 100

# Save results to JSON
npx tsx scripts/benchmark-hard-ai.ts --output results.json
```

**Metrics Collected:**
- Min/Max/Avg/Median score
- Standard deviation, percentiles (P10, P25, P75, P90)
- Score distribution (< 40, < 50, < 60, >= 70, >= 80)
- Average duration (ms)

**Compare Scoring** (`compare-scoring.ts`):
Validates TypeScript frontend scoring matches Python backend.

**Prerequisites:** Backend must be running (serves card data via `/api/cards/attributes` and `/api/cards/effects`). Verify with `curl -s http://localhost:8080/api/health`.

**Performance:**
- Single game: ~200-500ms
- Hard AI decision: ~500-3000ms (MCTS)
- 100 games: ~30-60 seconds
- 1000 games (Hard vs Hard): ~5-15 minutes

### Training (training/)

YOLO11 training pipeline for card detection/identification.

- `generate_dataset.py` - Synthetic dataset generator with augmentations
- `train.py` - Training script with MPS support
- `dataset/` - Generated training data (5000 train, 500 val images)

### MCP Server (mcp/)

TypeScript MCP server exposing card data for Claude Code integration.

**Build:** `cd mcp && npm install && npm run build`

**Tools:**
- `get_card` - Get full card data by ID (001-092)
- `list_cards` - List all 92 cards (id + name)
- `search_cards` - Search by name (accent-insensitive), category, attributes

**Configuration:** `.mcp.json` at project root

**IMPORTANT:** Always use the `chato-combourg` MCP tools when:
- Looking up card data (attributes, effects, cost, shields, category)
- Searching for cards by name or characteristics
- Needing to understand card mechanics for Play mode implementation
- Answering questions about specific cards or card interactions

Do NOT read the JSON files directly - use the MCP tools instead.

## API Endpoints

### Card Recognition
- `POST /api/analyze` - Upload photo, returns identified cards with positions
- `POST /api/calculate` - Calculate score from 9 cards + keys + coins
- `GET /api/cards` - List all 92 reference cards
- `GET /api/cards/attributes` - Card attributes for Play mode
- `GET /api/cards/effects` - Card effects for Play mode

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
