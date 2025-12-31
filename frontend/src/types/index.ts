// Card types
export interface CardMatch {
  id: string;
  probability: number;
}

export interface BoundingBox {
  x: number;      // Left edge as percentage (0-100)
  y: number;      // Top edge as percentage (0-100)
  width: number;  // Width as percentage (0-100)
  height: number; // Height as percentage (0-100)
}

export interface CardResult {
  position: [number, number]; // [row, col]
  matches: CardMatch[];
  method: string;
  bbox?: BoundingBox;
}

export interface AnalyzeResponse {
  success: boolean;
  message?: string;
  cards: CardResult[];
  capture_id?: string;
}

// Capture finalization types
export type FinalizeStatus = 'failed' | 'fixed' | 'success';

export interface CardLabel {
  position: number;
  card_id: string;
  bbox?: BoundingBox;
}

export interface FinalizeRequest {
  status: FinalizeStatus;
  detection_count: number;
  original_cards?: CardLabel[];
  final_cards?: CardLabel[];
}

export interface FinalizeResponse {
  success: boolean;
  message: string;
  category?: string;
}

// Calculator types
export interface CardScoreDetail {
  position: number;
  card_id: string;
  score: number;
  explanation: string;
}

export interface CalculateRequest {
  cards: string[];
  keys: number;
  total_coins: number;
}

export interface CalculateResponse {
  total_score: number;
  keys_bonus: number;
  cards_score: number;
  details: CardScoreDetail[];
}

// Card metadata
export interface Shield {
  count: number;
  color: string;
}

export interface CardAttributes {
  value: number;
  shields: Shield[];
  category: string | null;
  has_price_reduction: boolean;
  has_lock: boolean;
  has_coin_purse: boolean;
  max_coins: number;
}

export interface Card {
  id: string;
  'file-name': string;
  name: string;
}

// Game state
export interface GameCard {
  position: number; // 0-8
  cardId: string;
  confidence: number;
  alternatives: CardMatch[];
}

export interface GameState {
  step: 'landing' | 'players' | 'keys' | 'coins' | 'camera' | 'review' | 'summary' | 'games' | 'settings';
  cards: GameCard[];
  keys: number;
  coins: number;
  score: CalculateResponse | null;
  selectedPlayers: SelectedPlayer[]; // Players for current game
  currentPlayerIndex: number; // Which player's board we're capturing
  captureId?: string; // Current capture ID for finalization
  originalCards?: GameCard[]; // Original cards before corrections
}

// User & Players (from API)
export interface User {
  id: string;
  email: string | null;
  name: string | null;
}

export interface Player {
  id: number;
  name: string;
  color: string;
}

export interface SelectedPlayer extends Player {
  keys: number;
  coins: number;
  cards: GameCard[];
  score: CalculateResponse | null;
  captureId?: string;
  originalCards?: GameCard[];  // Cards as detected, before corrections
}

// Games (from API)
export interface GameListItem {
  id: number;
  played_at: string;
  notes: string | null;
  player_count: number;
  winner_name: string | null;
  winner_score: number | null;
}

export interface GamePlayerData {
  id: number;
  player_id: number;
  player_name: string;
  player_color: string;
  position: number;
  keys: number;
  coins: number;
  cards: string[];
  score: number;
  rank: number | null;
}

export interface GameDetail {
  id: number;
  played_at: string;
  notes: string | null;
  players: GamePlayerData[];
}

export interface GamePlayerCreate {
  player_id: number;
  keys: number;
  coins: number;
  cards: string[];
  score: number;
}

export interface GameCreate {
  players: GamePlayerCreate[];
  notes?: string;
}

// Settings
export type PlayerOrderMode = 'alphabetical' | 'manual' | 'most_played' | 'last_played';
export type OfflineMode = 'never' | 'fallback' | 'always';
export type DetectionModel = 'openvino' | 'pytorch';

export interface UserSettings {
  player_order: PlayerOrderMode;
  manual_player_order?: number[]; // Player IDs in custom order
  offline_mode?: OfflineMode;
  detection_model?: DetectionModel;
}

// Player with stats (for settings)
export interface PlayerWithStats extends Player {
  games_count: number;
  last_played_at: string | null;
}
