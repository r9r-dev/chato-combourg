#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Types
interface CardBase {
  id: string;
  "file-name": string;
  name: string;
}

interface Shield {
  count: number;
  color: string;
}

interface CardAttributes {
  value: number;
  shields: Shield[];
  category: "castle" | "village" | null;
  has_messenger: boolean;
  has_price_reduction: boolean;
  has_lock: boolean;
  has_coin_purse: boolean;
  max_coins: number;
}

interface Effect {
  type: string;
  [key: string]: unknown;
}

interface CardEffects {
  has_messenger: boolean;
  effects: Effect[];
  lock_effect: Effect | null;
}

interface ScoringRule {
  type: string;
  [key: string]: unknown;
}

interface Card extends CardBase, CardAttributes {
  effects: Effect[];
  lock_effect: Effect | null;
  scoring_rule: ScoringRule;
}

// Load and merge card data
function loadCardData(): Map<string, Card> {
  const cardsPath = join(__dirname, "../../backend/cards");

  const cardsJson: CardBase[] = JSON.parse(
    readFileSync(join(cardsPath, "cards.json"), "utf-8")
  );
  const attributesJson: Record<string, CardAttributes> = JSON.parse(
    readFileSync(join(cardsPath, "card_attributes.json"), "utf-8")
  );
  const effectsJson: Record<string, CardEffects> = JSON.parse(
    readFileSync(join(cardsPath, "card_effects.json"), "utf-8")
  );
  const scoringJson: Record<string, ScoringRule> = JSON.parse(
    readFileSync(join(cardsPath, "card_scoring.json"), "utf-8")
  );

  const cards = new Map<string, Card>();

  for (const card of cardsJson) {
    const attributes = attributesJson[card.id];
    const effects = effectsJson[card.id];
    const scoring = scoringJson[card.id];

    if (attributes && effects && scoring) {
      cards.set(card.id, {
        ...card,
        ...attributes,
        effects: effects.effects,
        lock_effect: effects.lock_effect,
        scoring_rule: scoring,
      });
    }
  }

  return cards;
}

// Normalize string for accent-insensitive search
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Create and configure server
const server = new McpServer({
  name: "chato-combourg",
  version: "1.0.0",
});

// Load card data
const cards = loadCardData();

// Tool: get_card
server.registerTool(
  "get_card",
  {
    title: "Get Card",
    description:
      "Get all data for a card by its ID (001-092). Returns name, attributes, effects (on placement), lock effect, and scoring rule (end of game).",
    inputSchema: {
      id: z
        .string()
        .regex(/^0[0-9]{2}$/)
        .describe("Card ID from 001 to 092"),
    },
  },
  async ({ id }) => {
    const card = cards.get(id);

    if (!card) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Card not found: ${id}` }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(card, null, 2) }],
    };
  }
);

// Tool: list_cards
server.registerTool(
  "list_cards",
  {
    title: "List Cards",
    description: "List all 92 cards with their ID and name.",
    inputSchema: {},
  },
  async () => {
    const list = Array.from(cards.values()).map((card) => ({
      id: card.id,
      name: card.name,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
    };
  }
);

// Tool: search_cards
server.registerTool(
  "search_cards",
  {
    title: "Search Cards",
    description:
      "Search cards by name (accent/case insensitive), category (castle/village), or attributes (has_messenger, has_lock, has_price_reduction, has_coin_purse). Returns matching cards with full data.",
    inputSchema: {
      name: z
        .string()
        .optional()
        .describe("Search by name (accent and case insensitive)"),
      category: z
        .enum(["castle", "village"])
        .optional()
        .describe("Filter by category"),
      has_messenger: z.boolean().optional().describe("Filter by messenger"),
      has_lock: z.boolean().optional().describe("Filter by lock"),
      has_price_reduction: z
        .boolean()
        .optional()
        .describe("Filter by price reduction"),
      has_coin_purse: z.boolean().optional().describe("Filter by coin purse"),
      shield_color: z
        .enum(["blue", "pink", "orange", "red"])
        .optional()
        .describe("Filter by shield color"),
      min_value: z.number().optional().describe("Minimum card value (cost)"),
      max_value: z.number().optional().describe("Maximum card value (cost)"),
    },
  },
  async ({
    name,
    category,
    has_messenger,
    has_lock,
    has_price_reduction,
    has_coin_purse,
    shield_color,
    min_value,
    max_value,
  }) => {
    let results = Array.from(cards.values());

    // Filter by name (accent/case insensitive)
    if (name) {
      const normalizedSearch = normalize(name);
      results = results.filter((card) =>
        normalize(card.name).includes(normalizedSearch)
      );
    }

    // Filter by category
    if (category) {
      results = results.filter((card) => card.category === category);
    }

    // Filter by boolean attributes
    if (has_messenger !== undefined) {
      results = results.filter((card) => card.has_messenger === has_messenger);
    }
    if (has_lock !== undefined) {
      results = results.filter((card) => card.has_lock === has_lock);
    }
    if (has_price_reduction !== undefined) {
      results = results.filter(
        (card) => card.has_price_reduction === has_price_reduction
      );
    }
    if (has_coin_purse !== undefined) {
      results = results.filter(
        (card) => card.has_coin_purse === has_coin_purse
      );
    }

    // Filter by shield color
    if (shield_color) {
      results = results.filter((card) =>
        card.shields.some((shield) => shield.color === shield_color)
      );
    }

    // Filter by value range
    if (min_value !== undefined) {
      results = results.filter((card) => card.value >= min_value);
    }
    if (max_value !== undefined) {
      results = results.filter((card) => card.value <= max_value);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: results.length,
              cards: results,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
