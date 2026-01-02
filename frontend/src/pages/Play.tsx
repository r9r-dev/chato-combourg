/**
 * Play - Interface de jeu principale (Mobile-first)
 *
 * Layout:
 * - Plateau central (2x3 cartes)
 * - Joueur actuel (3x3 + ressources)
 * - Autres joueurs (mini-grilles scrollables)
 * - Barre d'actions
 */

import { useState, useMemo } from 'react';
import { usePlay } from '../context/PlayContext';
import { getValidPlacements } from '../types/play';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { PlayPlayer, PlacedCard } from '../types/play';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// Composants internes
// =============================================================================

/** Carte du plateau central (achetable) */
function CentralCard({
  cardId,
  canAfford,
  cost,
  isActive,
  onBuy,
  onBuyFlipped,
}: {
  cardId: string;
  canAfford: boolean;
  cost: number;
  isActive: boolean;
  onBuy: () => void;
  onBuyFlipped: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const handleClick = () => {
    if (!isActive) return;
    setShowMenu(true);
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={!isActive}
        className={`relative w-full aspect-[5/7] rounded-lg overflow-hidden border-2 transition-all ${
          isActive
            ? canAfford
              ? 'border-gold hover:border-gold-light cursor-pointer'
              : 'border-white/30 hover:border-white/50 cursor-pointer'
            : 'border-transparent opacity-60'
        }`}
      >
        <img
          src={`${API_BASE}/cards/thumbs/carte_${cardId}.webp`}
          alt={`Carte ${cardId}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Prix */}
        <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold ${
          canAfford ? 'bg-gold text-dark' : 'bg-dark/80 text-white/60'
        }`}>
          {cost}
        </div>
      </button>

      {/* Menu d'achat */}
      {showMenu && (
        <div className="absolute inset-0 bg-dark/90 rounded-lg flex flex-col items-center justify-center gap-2 z-10">
          <button
            onClick={() => { onBuy(); setShowMenu(false); }}
            disabled={!canAfford}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              canAfford
                ? 'bg-gold text-dark'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            Acheter ({cost})
          </button>
          <button
            onClick={() => { onBuyFlipped(); setShowMenu(false); }}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20"
          >
            Face cachee (+6, +2)
          </button>
          <button
            onClick={() => setShowMenu(false)}
            className="px-3 py-1.5 text-white/40 text-sm"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

/** Case du plateau joueur */
function PlayerCell({
  card,
  isValid,
  isActive,
  onClick,
}: {
  card: PlacedCard | null;
  isValid: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  if (card) {
    return (
      <div className="aspect-[5/7] rounded-lg overflow-hidden border border-white/10">
        <img
          src={`${API_BASE}/cards/thumbs/carte_${card.cardId}.webp`}
          alt={`Carte ${card.cardId}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!isActive || !isValid}
      className={`aspect-[5/7] rounded-lg border-2 transition-all flex items-center justify-center ${
        isActive && isValid
          ? 'border-gold border-dashed bg-gold/10 hover:bg-gold/20 cursor-pointer'
          : 'border-white/10 bg-dark-lighter'
      }`}
    >
      {isActive && isValid && (
        <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  );
}

/** Mini-grille d'un autre joueur */
function MiniPlayerBoard({ player, isCurrentTurn }: { player: PlayPlayer; isCurrentTurn: boolean }) {
  const cardCount = player.board.filter(c => c !== null).length;

  return (
    <div className={`p-2 rounded-xl ${isCurrentTurn ? 'bg-gold/20 border border-gold' : 'bg-dark-lighter'}`}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: player.color }}
        >
          {player.isAI ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 7H7v6h6V7z" />
              <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
            </svg>
          ) : (
            player.name.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-white text-xs truncate flex-1">{player.name}</span>
        <span className="text-gold text-xs">{player.gold}</span>
      </div>

      <div className="grid grid-cols-3 gap-0.5">
        {player.board.map((card, i) => (
          <div
            key={i}
            className={`aspect-[5/7] rounded ${card ? '' : 'bg-dark/50'}`}
          >
            {card && (
              <img
                src={`${API_BASE}/cards/thumbs/carte_${card.cardId}.webp`}
                alt=""
                className="w-full h-full object-cover rounded"
                loading="lazy"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs text-white/40 mt-1">
        <span>{cardCount}/9</span>
        <span>{player.keys} cles</span>
      </div>
    </div>
  );
}

/** Indicateur du messager */
function MessengerIndicator({ location }: { location: 'castle' | 'village' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <div className={`w-2 h-2 rounded-full ${location === 'castle' ? 'bg-gold' : 'bg-white/20'}`} />
      <svg
        className={`w-5 h-5 ${location === 'castle' ? 'text-gold rotate-180' : 'text-gold'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
      </svg>
      <div className={`w-2 h-2 rounded-full ${location === 'village' ? 'bg-gold' : 'bg-white/20'}`} />
    </div>
  );
}

// =============================================================================
// Composant principal
// =============================================================================

export function Play() {
  const {
    state,
    buyCard,
    buyCardFlipped,
    placeCard,
    chooseEffect,
    endTurn,
    spendKey,
    reset,
    getCurrentPlayer,
    canAffordCard,
    isCurrentPlayerAI,
  } = usePlay();

  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const gameState = state.gameState;
  const currentPlayer = getCurrentPlayer();

  // Positions valides pour le placement
  const validPlacements = useMemo(() => {
    if (!currentPlayer) return [];
    return getValidPlacements(currentPlayer.board);
  }, [currentPlayer]);

  // Phase actuelle
  const isBuyPhase = gameState?.turnPhase === 'pre_action' || gameState?.turnPhase === 'buy';
  const isPlacePhase = gameState?.turnPhase === 'place';
  const isEffectPhase = state.step === 'effect_choice';
  const canEndTurn = gameState?.turnPhase === 'post_action' || gameState?.turnPhase === 'end';

  // Autres joueurs
  const otherPlayers = useMemo(() => {
    if (!gameState) return [];
    return gameState.players.filter(p => p.id !== currentPlayer?.id);
  }, [gameState, currentPlayer]);

  if (!gameState || !currentPlayer) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-white/60">Chargement...</div>
      </div>
    );
  }

  const handleBuy = (cardId: string) => {
    if (!isBuyPhase || isCurrentPlayerAI()) return;
    buyCard(cardId);
  };

  const handleBuyFlipped = (cardId: string) => {
    if (!isBuyPhase || isCurrentPlayerAI()) return;
    buyCardFlipped(cardId);
  };

  const handlePlace = (position: number) => {
    if (!isPlacePhase || isCurrentPlayerAI()) return;
    placeCard(position);
  };

  const handleEndTurn = () => {
    if (!canEndTurn || isCurrentPlayerAI()) return;
    endTurn();
  };

  const handleSpendKey = (target: 'castle' | 'village') => {
    if (gameState.turnPhase !== 'pre_action' || currentPlayer.keys < 1) return;
    spendKey(target);
  };

  return (
    <div className="flex flex-col h-dvh bg-dark">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-white/10">
        <button onClick={() => setShowQuitConfirm(true)} className="text-white/60 hover:text-white text-sm">
          Quitter
        </button>
        <div className="text-center">
          <span className="text-white font-medium">Tour {gameState.turnNumber}</span>
          <span className="text-white/40 text-sm ml-2">
            {state.aiThinking ? 'IA reflechit...' : ''}
          </span>
        </div>
        <div className="text-gold text-sm">
          {currentPlayer.name}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Plateau central */}
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-castle font-medium">Chateau</span>
            <span className="text-xs text-white/40">
              {gameState.board.messengerLocation === 'castle' ? 'Messager ici' : ''}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-1">
            {gameState.board.castleCards.map((cardId) => {
              const { canAfford, cost } = canAffordCard(cardId);
              return (
                <CentralCard
                  key={cardId}
                  cardId={cardId}
                  canAfford={canAfford}
                  cost={cost}
                  isActive={isBuyPhase && gameState.board.messengerLocation === 'castle' && !isCurrentPlayerAI()}
                  onBuy={() => handleBuy(cardId)}
                  onBuyFlipped={() => handleBuyFlipped(cardId)}
                />
              );
            })}
          </div>

          <MessengerIndicator location={gameState.board.messengerLocation} />

          <div className="grid grid-cols-3 gap-2 mt-1">
            {gameState.board.villageCards.map((cardId) => {
              const { canAfford, cost } = canAffordCard(cardId);
              return (
                <CentralCard
                  key={cardId}
                  cardId={cardId}
                  canAfford={canAfford}
                  cost={cost}
                  isActive={isBuyPhase && gameState.board.messengerLocation === 'village' && !isCurrentPlayerAI()}
                  onBuy={() => handleBuy(cardId)}
                  onBuyFlipped={() => handleBuyFlipped(cardId)}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-village font-medium">Village</span>
            <span className="text-xs text-white/40">
              {gameState.board.messengerLocation === 'village' ? 'Messager ici' : ''}
            </span>
          </div>
        </div>

        {/* Joueur actuel */}
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: currentPlayer.color }}
              >
                {currentPlayer.isAI ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 7H7v6h6V7z" />
                    <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                  </svg>
                ) : (
                  currentPlayer.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-white font-medium">{currentPlayer.name}</span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-gold">{currentPlayer.gold} or</span>
              <span className="text-blue-400">{currentPlayer.keys} cles</span>
            </div>
          </div>

          {/* Reductions */}
          {(currentPlayer.reductionCastle > 0 || currentPlayer.reductionVillage > 0) && (
            <div className="flex gap-3 mb-3 text-xs">
              {currentPlayer.reductionCastle > 0 && (
                <span className="text-castle">-{currentPlayer.reductionCastle} chateau</span>
              )}
              {currentPlayer.reductionVillage > 0 && (
                <span className="text-village">-{currentPlayer.reductionVillage} village</span>
              )}
            </div>
          )}

          {/* Plateau du joueur */}
          <div className="grid grid-cols-3 gap-2">
            {currentPlayer.board.map((card, position) => (
              <PlayerCell
                key={position}
                card={card}
                isValid={validPlacements.includes(position)}
                isActive={isPlacePhase && !isCurrentPlayerAI()}
                onClick={() => handlePlace(position)}
              />
            ))}
          </div>

          {/* Message de phase */}
          <div className="mt-3 text-center text-sm">
            {state.aiThinking && (
              <span className="text-gold animate-pulse">L'IA reflechit...</span>
            )}
            {!state.aiThinking && isBuyPhase && !isCurrentPlayerAI() && (
              <span className="text-white/60">Cliquez sur une carte pour l'acheter</span>
            )}
            {!state.aiThinking && isPlacePhase && !isCurrentPlayerAI() && (
              <span className="text-gold">Placez la carte sur votre plateau</span>
            )}
            {!state.aiThinking && canEndTurn && !isCurrentPlayerAI() && (
              <span className="text-white/60">Terminez votre tour</span>
            )}
          </div>
        </div>

        {/* Autres joueurs */}
        {otherPlayers.length > 0 && (
          <div className="p-3">
            <p className="text-white/40 text-xs mb-2">Autres joueurs</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {otherPlayers.map((player) => (
                <div key={player.id} className="flex-shrink-0 w-32">
                  <MiniPlayerBoard
                    player={player}
                    isCurrentTurn={gameState.players[gameState.currentPlayerIndex].id === player.id}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isCurrentPlayerAI() && (
        <footer className="p-3 border-t border-white/10 bg-dark-lighter">
          <div className="flex gap-2">
            {/* Bouton cle */}
            {gameState.turnPhase === 'pre_action' && currentPlayer.keys > 0 && (
              <div className="flex-1 flex gap-2">
                <button
                  onClick={() => handleSpendKey(gameState.board.messengerLocation === 'castle' ? 'village' : 'castle')}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-900 text-white font-medium text-sm"
                >
                  Deplacer messager
                </button>
                <button
                  onClick={() => handleSpendKey(gameState.board.messengerLocation)}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-900/50 text-white font-medium text-sm"
                >
                  Rafraichir lieu
                </button>
              </div>
            )}

            {/* Bouton terminer tour */}
            {canEndTurn && (
              <button
                onClick={handleEndTurn}
                className="flex-1 py-3 px-4 rounded-xl bg-gold text-dark font-semibold"
              >
                Terminer le tour
              </button>
            )}

            {/* Indicateur si achat en cours */}
            {isPlacePhase && (
              <div className="flex-1 py-3 px-4 rounded-xl bg-gold/20 text-gold text-center font-medium">
                Placez la carte achetee
              </div>
            )}
          </div>
        </footer>
      )}

      {/* Modal choix d'effet */}
      {isEffectPhase && state.pendingEffectChoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-card rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold text-lg mb-4 text-center">Choisissez un effet</h3>
            <div className="space-y-3">
              {state.pendingEffectChoice.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => chooseEffect(index)}
                  className="w-full py-4 px-4 rounded-xl bg-dark-lighter hover:bg-white/10 transition-colors text-left"
                >
                  <span className="text-white">
                    {option.type === 'gain_gold' && `+${option.amount} or`}
                    {option.type === 'gain_keys' && `+${option.amount} cle(s)`}
                    {option.type === 'fill_purses' && `Remplir bourses (+${option.amount})`}
                    {!['gain_gold', 'gain_keys', 'fill_purses'].includes(option.type) && option.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quit confirmation */}
      <ConfirmDialog
        isOpen={showQuitConfirm}
        title="Quitter la partie ?"
        message="La partie ne sera pas sauvegardee."
        confirmLabel="Quitter"
        cancelLabel="Continuer"
        onConfirm={() => { reset(); }}
        onCancel={() => setShowQuitConfirm(false)}
      />
    </div>
  );
}
