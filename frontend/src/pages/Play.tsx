/**
 * Play - Interface de jeu principale (Mobile-first)
 *
 * Layout:
 * - Plateau central (2x3 cartes)
 * - Joueur actuel (3x3 + ressources)
 * - Autres joueurs (mini-grilles scrollables)
 * - Barre d'actions
 */

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { usePlay } from '../context/PlayContext';
import { getValidPlacements, getExternalZones } from '../types/play';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GameLog } from '../components/GameLog';
import { CoinIcon, KeyIcon, ShieldIcon } from '../components/Icons';
import { CentralCard, PlayerCell, MiniPlayerBoard, PlayerBoardModal } from '../components/play';
import type { PlayPlayer, ShiftDirection, CardEffect, PlayGameState, ShieldColor, ReplaceLocationChoice } from '../types/play';
import { countShieldsOnBoard, getNeighborPlayers, SHIELD_COLOR_NAMES } from '../utils/boardHelpers';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// Helpers pour formater les descriptions d'effets
// =============================================================================

function GoldAmount({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-gold">
      +{amount} <CoinIcon className="w-4 h-4" />
    </span>
  );
}

function KeyAmount({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-blue-400">
      +{amount} <KeyIcon className="w-4 h-4" />
    </span>
  );
}

function getReplaceLocationDescription(choice: ReplaceLocationChoice): string {
  const keysPerCard = choice.keysPerCard ?? 0;

  switch (choice.effectType) {
    case 'replace_location':
      return 'Choisissez un lieu pour remplacer toutes ses cartes.';
    case 'replace_location_gain_keys_per_feature': {
      const featureName = choice.feature === 'price_reduction' ? 'reduction' : 'bourse';
      return `Remplacez toutes les cartes d'un lieu et gagnez ${keysPerCard} cle${keysPerCard > 1 ? 's' : ''} par carte ${featureName}.`;
    }
    case 'replace_location_gain_keys_per_shield': {
      const colorName = choice.color ? SHIELD_COLOR_NAMES[choice.color] : '';
      return `Remplacez toutes les cartes d'un lieu et gagnez ${keysPerCard} cle${keysPerCard > 1 ? 's' : ''} par carte avec bouclier ${colorName}.`;
    }
    default:
      return 'Choisissez un lieu a remplacer.';
  }
}

function EffectDescription({ effect, state }: { effect: CardEffect; state: PlayGameState }) {
  const player = state.players[state.currentPlayerIndex];
  const amount = effect.amount ?? 0;

  switch (effect.type) {
    case 'gain_gold':
      return <GoldAmount amount={amount} />;

    case 'gain_keys':
      return <KeyAmount amount={amount} />;

    case 'fill_purses':
      return <span>Remplir bourses (+{amount})</span>;

    case 'gain_gold_per_shield_neighbor':
    case 'gain_keys_per_shield_neighbor': {
      const color = effect.color as ShieldColor;
      const neighbors = getNeighborPlayers(state, state.currentPlayerIndex);
      let maxShields = 0;
      for (const neighbor of neighbors) {
        const count = countShieldsOnBoard(neighbor, color);
        maxShields = Math.max(maxShields, count);
      }
      const total = maxShields * amount;
      const isGold = effect.type === 'gain_gold_per_shield_neighbor';
      return (
        <span className="inline-flex items-center gap-2">
          {isGold ? <GoldAmount amount={total} /> : <KeyAmount amount={total} />}
          <span className="inline-flex items-center gap-1 text-white/60 text-sm">
            ({maxShields} <ShieldIcon color={color} className="w-4 h-4" />)
          </span>
        </span>
      );
    }

    case 'gain_gold_per_shield':
    case 'gain_keys_per_shield': {
      const color = effect.color as ShieldColor;
      const shieldCount = countShieldsOnBoard(player, color);
      const total = shieldCount * amount;
      const isGold = effect.type === 'gain_gold_per_shield';
      return (
        <span className="inline-flex items-center gap-2">
          {isGold ? <GoldAmount amount={total} /> : <KeyAmount amount={total} />}
          <span className="inline-flex items-center gap-1 text-white/60 text-sm">
            ({shieldCount} <ShieldIcon color={color} className="w-4 h-4" />)
          </span>
        </span>
      );
    }

    default:
      return <span>{effect.type}</span>;
  }
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
    useKeyOnLock,
    reset,
    getCurrentPlayer,
    canAffordCard,
    isCurrentPlayerAI,
    toggleGameLog,
    gameLog,
    showGameLog,
    pendingDiscardChoice,
    selectDiscardCard,
    pendingReplaceLocationChoice,
    selectReplaceLocation,
    pendingAdjacentCardChoice,
    selectAdjacentCard,
    debugRefreshCards,
    debugMoveMessenger,
    debugAddResources,
  } = usePlay();

  const isDev = import.meta.env.DEV;

  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayPlayer | null>(null);
  const [showPurchasedCard, setShowPurchasedCard] = useState(false);
  const playerBoardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  const isPostActionPhase = gameState?.turnPhase === 'post_action';
  const isEffectPhase = state.step === 'effect_choice';

  // Scroll vers le plateau du joueur quand on entre en phase de placement
  useEffect(() => {
    if (isPlacePhase && playerBoardRef.current) {
      playerBoardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isPlacePhase]);

  // Scroll vers le haut quand on entre en phase d'achat (debut de tour)
  useEffect(() => {
    if (isBuyPhase && !isCurrentPlayerAI() && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isBuyPhase, isCurrentPlayerAI]);

  // Peut utiliser un cadenas : en pre_action ou post_action, si pas deja utilise ce tour
  const canUseLock = (isBuyPhase || isPostActionPhase) && !gameState?.lockUsedThisTurn && !isCurrentPlayerAI();
  const isDiscardPhase = state.step === 'discard_choice';
  const isReplaceLocationPhase = state.step === 'replace_location_choice';
  const isAdjacentCardPhase = state.step === 'adjacent_card_choice';
  const canEndTurn = gameState?.turnPhase === 'post_action' || gameState?.turnPhase === 'end';

  // Cartes disponibles pour la defausse
  const discardableCards = useMemo(() => {
    if (!gameState || !pendingDiscardChoice) return [];
    return pendingDiscardChoice.location === 'castle'
      ? gameState.board.castleCards
      : gameState.board.villageCards;
  }, [gameState, pendingDiscardChoice]);

  // Options de cartes adjacentes
  const adjacentCardOptions = useMemo(() => {
    if (!gameState || !pendingAdjacentCardChoice) return [];
    const player = gameState.players[gameState.currentPlayerIndex];
    return pendingAdjacentCardChoice.adjacentPositions.map(pos => {
      const placedCard = player.board[pos];
      return {
        position: pos,
        cardId: placedCard?.cardId ?? '',
      };
    }).filter(opt => opt.cardId !== '');
  }, [gameState, pendingAdjacentCardChoice]);

  // Autres joueurs
  const otherPlayers = useMemo(() => {
    if (!gameState) return [];
    return gameState.players.filter(p => p.id !== currentPlayer?.id);
  }, [gameState, currentPlayer]);

  // Indices des voisins (gauche et droite dans l'ordre de jeu)
  const neighborIds = useMemo(() => {
    if (!gameState || !currentPlayer) return new Set<string>();
    const playerCount = gameState.players.length;
    const currentIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    const leftIndex = (currentIndex - 1 + playerCount) % playerCount;
    const rightIndex = (currentIndex + 1) % playerCount;
    return new Set([
      gameState.players[leftIndex].id,
      gameState.players[rightIndex].id,
    ]);
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
    if (gameState.turnPhase !== 'pre_action' || currentPlayer.keys < 1 || gameState.keyUsedThisTurn) return;
    spendKey(target);
  };

  // Zones externes pour placement avec shift automatique
  const externalZones = useMemo(() => {
    if (!currentPlayer || !isPlacePhase) return [];
    return getExternalZones(currentPlayer.board);
  }, [currentPlayer, isPlacePhase]);

  // Calcul des bords actifs pour layout dynamique
  const activeEdges = useMemo(() => ({
    left: externalZones.some(z => z.edge === 'left'),
    right: externalZones.some(z => z.edge === 'right'),
    top: externalZones.some(z => z.edge === 'top'),
    bottom: externalZones.some(z => z.edge === 'bottom'),
  }), [externalZones]);

  // Handler pour placement sur zone externe
  const handleExternalPlace = (position: number, shiftDirection: ShiftDirection) => {
    if (!isPlacePhase || isCurrentPlayerAI()) return;
    placeCard(position, shiftDirection);
  };

  return (
    <div className="flex flex-col h-dvh bg-dark">
      {/* Header */}
      <header className="relative flex items-center justify-between p-3 border-b border-white/10">
        <button onClick={() => setShowQuitConfirm(true)} className="text-white/60 hover:text-white text-sm z-10">
          Quitter
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-gold font-medium">
              <CoinIcon className="w-5 h-5" />
              {currentPlayer.gold}
            </span>
            <span className="flex items-center gap-1 text-blue-400 font-medium">
              <KeyIcon className="w-5 h-5" />
              {currentPlayer.keys}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 z-10">
          <span className="text-gold text-sm">{currentPlayer.name}</span>
          <button
            onClick={toggleGameLog}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              showGameLog ? 'bg-gold/20 text-gold' : 'hover:bg-white/10 text-white/60'
            }`}
            title="Historique des actions"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        {/* Plateau central */}
        <div className="p-3 border-b border-white/10">
          <div className={`flex items-center justify-between mb-2 pb-1 border-b-2 ${gameState.board.messengerLocation === 'castle' ? 'border-gold' : 'border-transparent'}`}>
            <span className="text-sm text-castle font-medium">Chateau</span>
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

          <div className="grid grid-cols-3 gap-2 mt-2">
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

          <div className={`flex items-center justify-between mt-2 pt-1 border-t-2 ${gameState.board.messengerLocation === 'village' ? 'border-gold' : 'border-transparent'}`}>
            <span className="text-sm text-village font-medium">Village</span>
          </div>

          {/* Debug buttons (dev mode only) */}
          {isDev && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-dashed border-red-500/30">
              <button
                onClick={debugRefreshCards}
                className="flex-1 py-1.5 px-2 rounded bg-red-900/50 text-red-300 text-xs font-medium hover:bg-red-900/70"
              >
                Rafraichir
              </button>
              <button
                onClick={debugMoveMessenger}
                className="flex-1 py-1.5 px-2 rounded bg-red-900/50 text-red-300 text-xs font-medium hover:bg-red-900/70"
              >
                Messager
              </button>
              <button
                onClick={debugAddResources}
                className="flex-1 py-1.5 px-2 rounded bg-red-900/50 text-red-300 text-xs font-medium hover:bg-red-900/70"
              >
                +10 or/cle
              </button>
            </div>
          )}
        </div>

        {/* Joueur actuel */}
        <div ref={playerBoardRef} className="p-3 border-b border-white/10">
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

          {/* Plateau du joueur avec zones externes - grille dynamique */}
          <div
            className="grid transition-all duration-300"
            style={{
              gridTemplateColumns: `${activeEdges.left ? '20px' : '0'} 1fr 1fr 1fr ${activeEdges.right ? '20px' : '0'}`,
              gap: '4px',
            }}
          >
            {/* Ligne 1: zones top */}
            <div style={{ height: activeEdges.top ? '20px' : '0' }} />
            {[0, 1, 2].map((edgeIndex) => {
              const zone = externalZones.find(z => z.edge === 'top' && z.edgeIndex === edgeIndex);
              return (
                <button
                  key={`top-${edgeIndex}`}
                  onClick={() => zone && handleExternalPlace(zone.position, zone.shiftDirection)}
                  disabled={!zone}
                  style={{ height: activeEdges.top ? '20px' : '0' }}
                  className={`rounded transition-all flex items-center justify-center overflow-hidden ${
                    zone
                      ? 'bg-gold/20 border-2 border-dashed border-gold/50 hover:bg-gold/30 text-gold/70'
                      : ''
                  }`}
                >
                  {zone && <span className="text-xs font-bold">+</span>}
                </button>
              );
            })}
            <div style={{ height: activeEdges.top ? '20px' : '0' }} />

            {/* Lignes 2-4: zones laterales + grille 3x3 */}
            {[0, 1, 2].map((row) => (
              <Fragment key={`row-${row}`}>
                {/* Zone gauche */}
                {(() => {
                  const zone = externalZones.find(z => z.edge === 'left' && z.edgeIndex === row);
                  return (
                    <button
                      key={`left-${row}`}
                      onClick={() => zone && handleExternalPlace(zone.position, zone.shiftDirection)}
                      disabled={!zone}
                      className={`rounded transition-all flex items-center justify-center overflow-hidden ${
                        zone
                          ? 'bg-gold/20 border-2 border-dashed border-gold/50 hover:bg-gold/30 text-gold/70'
                          : ''
                      }`}
                    >
                      {zone && <span className="text-xs font-bold">+</span>}
                    </button>
                  );
                })()}

                {/* 3 cellules du plateau */}
                {[0, 1, 2].map((col) => {
                  const position = row * 3 + col;
                  const card = currentPlayer.board[position];
                  return (
                    <PlayerCell
                      key={position}
                      card={card}
                      isValid={validPlacements.includes(position)}
                      isActive={isPlacePhase && !isCurrentPlayerAI()}
                      hasKey={currentPlayer.lockedCards.get(position) ?? false}
                      canUseKey={canUseLock}
                      onClick={() => handlePlace(position)}
                      onKeyClick={() => useKeyOnLock(position)}
                    />
                  );
                })}

                {/* Zone droite */}
                {(() => {
                  const zone = externalZones.find(z => z.edge === 'right' && z.edgeIndex === row);
                  return (
                    <button
                      key={`right-${row}`}
                      onClick={() => zone && handleExternalPlace(zone.position, zone.shiftDirection)}
                      disabled={!zone}
                      className={`rounded transition-all flex items-center justify-center overflow-hidden ${
                        zone
                          ? 'bg-gold/20 border-2 border-dashed border-gold/50 hover:bg-gold/30 text-gold/70'
                          : ''
                      }`}
                    >
                      {zone && <span className="text-xs font-bold">+</span>}
                    </button>
                  );
                })()}
              </Fragment>
            ))}

            {/* Ligne 5: zones bottom */}
            <div style={{ height: activeEdges.bottom ? '20px' : '0' }} />
            {[0, 1, 2].map((edgeIndex) => {
              const zone = externalZones.find(z => z.edge === 'bottom' && z.edgeIndex === edgeIndex);
              return (
                <button
                  key={`bottom-${edgeIndex}`}
                  onClick={() => zone && handleExternalPlace(zone.position, zone.shiftDirection)}
                  disabled={!zone}
                  style={{ height: activeEdges.bottom ? '20px' : '0' }}
                  className={`rounded transition-all flex items-center justify-center overflow-hidden ${
                    zone
                      ? 'bg-gold/20 border-2 border-dashed border-gold/50 hover:bg-gold/30 text-gold/70'
                      : ''
                  }`}
                >
                  {zone && <span className="text-xs font-bold">+</span>}
                </button>
              );
            })}
            <div style={{ height: activeEdges.bottom ? '20px' : '0' }} />
          </div>
        </div>

        {/* Autres joueurs */}
        {otherPlayers.length > 0 && (
          <div className="p-3">
            <p className="text-white/40 text-xs mb-2">Autres joueurs</p>
            <div className="grid grid-cols-2 gap-3">
              {otherPlayers.map((player) => (
                <MiniPlayerBoard
                  key={player.id}
                  player={player}
                  isCurrentTurn={gameState.players[gameState.currentPlayerIndex].id === player.id}
                  isNeighbor={neighborIds.has(player.id)}
                  onSelect={() => setSelectedPlayer(player)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Modal plateau joueur */}
        {selectedPlayer && (
          <PlayerBoardModal
            player={selectedPlayer}
            isNeighbor={neighborIds.has(selectedPlayer.id)}
            onClose={() => setSelectedPlayer(null)}
          />
        )}
      </div>

      {/* Bandeau flottant carte achetee - visible partiellement, appui long pour voir */}
      {isPlacePhase && gameState?.purchasedCard && !isCurrentPlayerAI() && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-0 pointer-events-none select-none">
          <img
            src={`${API_BASE}/cards/thumbs/carte_${gameState.purchasedCard}.webp`}
            alt="Carte achetee"
            className={`w-40 rounded-t-xl shadow-lg border-2 border-b-0 border-gold/50 transition-transform duration-150 pointer-events-auto ${
              showPurchasedCard ? '-translate-y-12' : 'translate-y-[50%]'
            }`}
            draggable={false}
            onPointerDown={() => setShowPurchasedCard(true)}
            onPointerUp={() => setShowPurchasedCard(false)}
            onPointerLeave={() => setShowPurchasedCard(false)}
            onPointerCancel={() => setShowPurchasedCard(false)}
          />
        </div>
      )}

      {/* Footer: Actions + Status */}
      <footer className="relative z-10 border-t border-white/10 bg-dark-lighter">
        {/* Boutons d'action (visible seulement s'il y a des boutons) */}
        {!isCurrentPlayerAI() && (
          (gameState.turnPhase === 'pre_action' && currentPlayer.keys > 0 && !gameState.keyUsedThisTurn) || canEndTurn
        ) && (
          <div className="p-3 flex gap-2">
            {/* Bouton cle */}
            {gameState.turnPhase === 'pre_action' && currentPlayer.keys > 0 && !gameState.keyUsedThisTurn && (
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
          </div>
        )}

        {/* Barre de statut */}
        <div className="px-3 py-2 text-center text-sm border-t border-white/5">
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
          {!state.aiThinking && isCurrentPlayerAI() && !canEndTurn && (
            <span className="text-white/40">Tour de l'IA</span>
          )}
        </div>
      </footer>

      {/* Modal choix d'effet */}
      {isEffectPhase && state.pendingEffectChoice && gameState && (
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
                  <EffectDescription effect={option} state={gameState} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal choix de carte a defausser */}
      {isDiscardPhase && pendingDiscardChoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-card rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-white font-semibold text-lg mb-2 text-center">
              Defaussez une carte
            </h3>
            <p className="text-white/60 text-sm mb-4 text-center">
              Choisissez une carte du {pendingDiscardChoice.location === 'castle' ? 'chateau' : 'village'} pour gagner son cout en {pendingDiscardChoice.resource === 'gold' ? 'or' : 'cles'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {discardableCards.map((cardId) => (
                <button
                  key={cardId}
                  onClick={() => selectDiscardCard(cardId)}
                  className="aspect-[5/7] rounded-lg overflow-hidden border-2 border-white/30 hover:border-gold transition-colors"
                >
                  <img
                    src={`${API_BASE}/cards/thumbs/carte_${cardId}.webp`}
                    alt={`Carte ${cardId}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal choix de lieu a remplacer */}
      {isReplaceLocationPhase && pendingReplaceLocationChoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-card rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold text-lg mb-2 text-center">
              Remplacer les cartes
            </h3>
            <p className="text-white/60 text-sm mb-4 text-center">
              {getReplaceLocationDescription(pendingReplaceLocationChoice)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => selectReplaceLocation('castle')}
                className="py-4 px-4 rounded-xl bg-castle/20 border-2 border-castle hover:bg-castle/30 transition-colors"
              >
                <div className="text-castle font-semibold text-lg mb-1">Chateau</div>
                <div className="text-white/60 text-sm">
                  {gameState?.board.castleCards.length ?? 0} cartes
                </div>
              </button>
              <button
                onClick={() => selectReplaceLocation('village')}
                className="py-4 px-4 rounded-xl bg-village/20 border-2 border-village hover:bg-village/30 transition-colors"
              >
                <div className="text-village font-semibold text-lg mb-1">Village</div>
                <div className="text-white/60 text-sm">
                  {gameState?.board.villageCards.length ?? 0} cartes
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal choix de carte adjacente */}
      {isAdjacentCardPhase && pendingAdjacentCardChoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-card rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-white font-semibold text-lg mb-2 text-center">
              Activer une carte adjacente
            </h3>
            <p className="text-white/60 text-sm mb-4 text-center">
              Choisissez une carte pour activer son effet
            </p>
            <div className={`grid gap-3 ${adjacentCardOptions.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {adjacentCardOptions.map((option) => (
                <button
                  key={option.position}
                  onClick={() => selectAdjacentCard(option.position)}
                  className="aspect-[5/7] rounded-lg overflow-hidden border-2 border-white/30 hover:border-gold transition-colors"
                >
                  <img
                    src={`${API_BASE}/cards/thumbs/carte_${option.cardId}.webp`}
                    alt={`Carte position ${option.position}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
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

      {/* Game Log */}
      <GameLog
        entries={gameLog}
        isOpen={showGameLog}
        onClose={toggleGameLog}
      />
    </div>
  );
}
