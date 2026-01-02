/**
 * GameLog - Panneau d'historique des actions
 *
 * Affiche les actions et effets des joueurs pendant la partie.
 * Structure: Tour > Joueur > Actions
 */

import { useRef, useEffect } from 'react';
import type { GameLogEntry, LogActionType } from '../types/play';
import { CoinIcon, KeyIcon, PositionGrid, BuyIcon, PlaceIcon, EffectIcon } from './Icons';

interface GameLogProps {
  entries: GameLogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Icone selon le type d'action
 */
function ActionIcon({ type }: { type: LogActionType }) {
  const className = 'w-4 h-4 text-white/60';

  switch (type) {
    case 'buy':
      return <BuyIcon className={className} />;
    case 'place':
      return <PlaceIcon className={className} />;
    case 'effect':
      return <EffectIcon className={`${className} text-gold/80`} />;
    case 'key':
      return <KeyIcon className={className} />;
    default:
      return <div className="w-4 h-4" />;
  }
}

/**
 * Formate le delta des ressources
 */
function formatResourceDelta(
  before: { gold: number; keys: number } | undefined,
  after: { gold: number; keys: number } | undefined
): { goldDelta: number; keysDelta: number } | null {
  if (!before || !after) return null;

  const goldDelta = after.gold - before.gold;
  const keysDelta = after.keys - before.keys;

  if (goldDelta === 0 && keysDelta === 0) return null;

  return { goldDelta, keysDelta };
}

/**
 * Composant pour afficher une variation de ressource avec icone
 */
function ResourceChange({ value, type }: { value: number; type: 'gold' | 'keys' }) {
  if (value === 0) return null;

  const isPositive = value > 0;
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
  const sign = isPositive ? '+' : '';

  return (
    <span className={`${colorClass} text-sm inline-flex items-center gap-0.5`}>
      {sign}{value}
      {type === 'gold' ? (
        <CoinIcon className="w-4 h-4" />
      ) : (
        <KeyIcon className="w-4 h-4" />
      )}
    </span>
  );
}

/**
 * Texte principal selon le type d'action
 */
function getLogText(entry: GameLogEntry): string | undefined {
  switch (entry.actionType) {
    case 'buy':
      return entry.cardName;
    case 'place':
    case 'effect':
      return entry.description;
    default:
      return entry.cardName ?? entry.description;
  }
}

/**
 * Ligne de log compacte
 */
function LogLine({ entry }: { entry: GameLogEntry }) {
  const delta = formatResourceDelta(entry.resourcesBefore, entry.resourcesAfter);
  const text = getLogText(entry);
  const showPosition = entry.actionType !== 'effect' && entry.position !== undefined;

  return (
    <div className="py-1.5 px-3 flex items-center gap-2 text-sm hover:bg-white/5">
      {/* Icone action */}
      <ActionIcon type={entry.actionType} />

      {/* Texte principal (nom carte ou description) */}
      {text && (
        <span className="text-white/80 flex-1 truncate">{text}</span>
      )}

      {/* Spacer si pas de texte */}
      {!text && <span className="flex-1" />}

      {/* Position (sauf pour effect) */}
      {showPosition && (
        <PositionGrid position={entry.position!} size={16} className="flex-shrink-0" />
      )}

      {/* Delta ressources */}
      {delta && (
        <div className="flex gap-2 flex-shrink-0">
          <ResourceChange value={delta.goldDelta} type="gold" />
          <ResourceChange value={delta.keysDelta} type="keys" />
        </div>
      )}
    </div>
  );
}

/**
 * Groupe les entrees par tour puis par joueur
 */
interface PlayerGroup {
  playerName: string;
  playerColor: string;
  entries: GameLogEntry[];
}

interface TurnGroup {
  turnNumber: number;
  players: PlayerGroup[];
}

function groupEntries(entries: GameLogEntry[]): TurnGroup[] {
  const turnMap = new Map<number, Map<string, GameLogEntry[]>>();

  for (const entry of entries) {
    if (!turnMap.has(entry.turnNumber)) {
      turnMap.set(entry.turnNumber, new Map());
    }
    const playerMap = turnMap.get(entry.turnNumber)!;

    const key = `${entry.playerName}-${entry.playerColor}`;
    if (!playerMap.has(key)) {
      playerMap.set(key, []);
    }
    playerMap.get(key)!.push(entry);
  }

  const result: TurnGroup[] = [];

  const sortedTurns = Array.from(turnMap.keys()).sort((a, b) => a - b);
  for (const turnNumber of sortedTurns) {
    const playerMap = turnMap.get(turnNumber)!;
    const players: PlayerGroup[] = [];

    for (const [, playerEntries] of playerMap) {
      if (playerEntries.length > 0) {
        players.push({
          playerName: playerEntries[0].playerName,
          playerColor: playerEntries[0].playerColor,
          entries: playerEntries,
        });
      }
    }

    result.push({ turnNumber, players });
  }

  return result;
}

export function GameLog({ entries, isOpen, onClose }: GameLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand de nouvelles entrees arrivent
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, isOpen]);

  const groupedData = groupEntries(entries);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panneau */}
      <div
        className={`
          fixed right-0 top-0 bottom-0 w-72
          bg-dark-lighter border-l border-white/10
          z-40 flex flex-col
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <h2 className="text-white font-semibold">Historique</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenu scrollable */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
        >
          {entries.length === 0 ? (
            <div className="p-4 text-center text-white/50 text-sm">
              Aucune action pour l'instant
            </div>
          ) : (
            groupedData.map(turn => (
              <div key={turn.turnNumber}>
                {/* Header de tour */}
                <div className="sticky top-0 px-3 py-1.5 bg-dark-card/95 backdrop-blur-sm border-b border-white/5">
                  <span className="text-sm text-gold font-medium">Tour {turn.turnNumber}</span>
                </div>

                {/* Joueurs du tour */}
                {turn.players.map((player, idx) => (
                  <div key={`${player.playerName}-${idx}`} className="border-b border-white/5">
                    {/* Header joueur */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5">
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: player.playerColor }}
                      >
                        {player.playerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-white/80 font-medium">{player.playerName}</span>
                    </div>

                    {/* Actions du joueur */}
                    <div className="divide-y divide-white/5">
                      {player.entries.map(entry => (
                        <LogLine key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
