// Card types
export interface CardMatch {
  id: string;
  probability: number;
}

export interface CardResult {
  position: [number, number]; // [row, col]
  matches: CardMatch[];
  method: string;
}

export interface AnalyzeResponse {
  success: boolean;
  message?: string;
  cards: CardResult[];
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
  coins_on_cards: Record<string, number>;
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
  step: 'landing' | 'camera' | 'summary';
  cards: GameCard[];
  keys: number;
  coins: number;
  score: CalculateResponse | null;
}
