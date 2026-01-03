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
import type { PlayPlayer, ShiftDirection, CardEffect, PlayGameState, ShieldColor, Location } from '../types/play';
import { countShieldsOnBoard, getNeighborPlayers } from '../utils/boardHelpers';
import { getCard } from '../services/play/gameEngine';

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
    <span className="inline-flex items-center gap-1 text-emerald-400">
      +{amount} <KeyIcon className="w-4 h-4" />
    </span>
  );
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
    pendingPurseSelectionChoice,
    selectPurses,
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
  const isPurseSelectionPhase = state.step === 'purse_selection_choice';
  const canEndTurn = gameState?.turnPhase === 'post_action' || gameState?.turnPhase === 'end';

  // Selection des bourses - positions selectionnees
  const [selectedPursePositions, setSelectedPursePositions] = useState<number[]>([]);

  // Positions surlignees sur le plateau joueur (cartes adjacentes ou bourses)
  const highlightedPositions = useMemo(() => {
    if (isAdjacentCardPhase && pendingAdjacentCardChoice) {
      return new Set(pendingAdjacentCardChoice.adjacentPositions);
    }
    if (isPurseSelectionPhase && pendingPurseSelectionChoice) {
      return new Set(pendingPurseSelectionChoice.availablePositions);
    }
    return new Set<number>();
  }, [isAdjacentCardPhase, isPurseSelectionPhase, pendingAdjacentCardChoice, pendingPurseSelectionChoice]);

  // Cartes selectionnables sur le plateau central (pour defausse)
  const discardLocation = isDiscardPhase && pendingDiscardChoice ? pendingDiscardChoice.location : null;

  // Handler pour selection sur plateau joueur
  const handlePlayerCellSelect = (position: number) => {
    if (isAdjacentCardPhase) {
      selectAdjacentCard(position);
    } else if (isPurseSelectionPhase) {
      togglePurseSelection(position);
    }
  };

  // Handler pour selection sur plateau central
  const handleCentralCardSelect = (cardId: string) => {
    if (isDiscardPhase) {
      selectDiscardCard(cardId);
    }
  };

  // Calcul du gain de cles pour le choix de lieu a remplacer
  const replaceLocationKeysGain = useMemo(() => {
    if (!gameState || !pendingReplaceLocationChoice) return { castle: 0, village: 0 };

    const choice = pendingReplaceLocationChoice;
    const keysPerCard = choice.keysPerCard ?? 0;

    // Si pas de gain de cles, retourner 0
    if (choice.effectType === 'replace_location') {
      return { castle: 0, village: 0 };
    }

    const countKeysForLocation = (location: Location): number => {
      const cards = location === 'castle'
        ? gameState.board.castleCards
        : gameState.board.villageCards;

      let matchingCards = 0;
      for (const cardId of cards) {
        const card = getCard(cardId);
        if (!card) continue;

        if (choice.effectType === 'replace_location_gain_keys_per_feature') {
          if (choice.feature === 'price_reduction' && card.has_price_reduction) {
            matchingCards++;
          } else if (choice.feature === 'coin_purse' && card.has_coin_purse) {
            matchingCards++;
          }
        } else if (choice.effectType === 'replace_location_gain_keys_per_shield') {
          const hasShield = card.shields.some(s => s.color === choice.color);
          if (hasShield) {
            matchingCards++;
          }
        }
      }

      return matchingCards * keysPerCard;
    };

    return {
      castle: countKeysForLocation('castle'),
      village: countKeysForLocation('village'),
    };
  }, [gameState, pendingReplaceLocationChoice]);

  // Reset selection quand le mode bourse s'active
  useEffect(() => {
    if (isPurseSelectionPhase) {
      setSelectedPursePositions([]);
    }
  }, [isPurseSelectionPhase]);

  // Toggle selection d'une bourse
  const togglePurseSelection = (position: number) => {
    setSelectedPursePositions(prev => {
      if (prev.includes(position)) {
        return prev.filter(p => p !== position);
      }
      const maxCards = pendingPurseSelectionChoice?.maxCards ?? 2;
      if (prev.length >= maxCards) {
        // Remplacer la premiere selection
        return [...prev.slice(1), position];
      }
      return [...prev, position];
    });
  };

  // Confirmer la selection des bourses
  const confirmPurseSelection = () => {
    if (selectedPursePositions.length > 0) {
      selectPurses(selectedPursePositions);
    }
  };

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
            <span className="text-sm text-castle font-medium">Château</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-1">
            {gameState.board.castleCards.map((cardId) => {
              const { canAfford, cost } = canAffordCard(cardId);
              const isSelectableForDiscard = discardLocation === 'castle';
              return (
                <CentralCard
                  key={cardId}
                  cardId={cardId}
                  canAfford={canAfford}
                  cost={cost}
                  isActive={isBuyPhase && gameState.board.messengerLocation === 'castle' && !isCurrentPlayerAI()}
                  onBuy={() => handleBuy(cardId)}
                  onBuyFlipped={() => handleBuyFlipped(cardId)}
                  isSelectable={isSelectableForDiscard}
                  onSelect={() => handleCentralCardSelect(cardId)}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2">
            {gameState.board.villageCards.map((cardId) => {
              const { canAfford, cost } = canAffordCard(cardId);
              const isSelectableForDiscard = discardLocation === 'village';
              return (
                <CentralCard
                  key={cardId}
                  cardId={cardId}
                  canAfford={canAfford}
                  cost={cost}
                  isActive={isBuyPhase && gameState.board.messengerLocation === 'village' && !isCurrentPlayerAI()}
                  onBuy={() => handleBuy(cardId)}
                  onBuyFlipped={() => handleBuyFlipped(cardId)}
                  isSelectable={isSelectableForDiscard}
                  onSelect={() => handleCentralCardSelect(cardId)}
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
                Rafraîchir
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
                +10 or/clé
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
                <span className="text-castle">-{currentPlayer.reductionCastle} château</span>
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
                  const isHighlighted = highlightedPositions.has(position);
                  const isSelected = isPurseSelectionPhase && selectedPursePositions.includes(position);
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
                      isHighlighted={isHighlighted}
                      isSelected={isSelected}
                      onSelect={isHighlighted ? () => handlePlayerCellSelect(position) : undefined}
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
        {/* Boutons d'action */}
        <div className="p-3 flex gap-2">
          {/* Boutons cle (pre_action) - caches pendant les phases de choix */}
          {!isCurrentPlayerAI() && gameState.turnPhase === 'pre_action' && currentPlayer.keys > 0 && !gameState.keyUsedThisTurn && !isEffectPhase && !isReplaceLocationPhase && !isDiscardPhase && !isAdjacentCardPhase && !isPurseSelectionPhase && (
            <>
              <button
                onClick={() => handleSpendKey(gameState.board.messengerLocation === 'castle' ? 'village' : 'castle')}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-900 text-white font-medium text-sm"
              >
                Déplacer messager
              </button>
              <button
                onClick={() => handleSpendKey(gameState.board.messengerLocation)}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-900/50 text-white font-medium text-sm"
              >
                Rafraîchir lieu
              </button>
            </>
          )}

          {/* Boutons choix d'effet [OU] */}
          {isEffectPhase && state.pendingEffectChoice && gameState && (
            <>
              {state.pendingEffectChoice.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => chooseEffect(index)}
                  className="flex-1 py-3 px-4 rounded-xl bg-indigo-900/80 hover:bg-indigo-800/80 text-white font-medium text-sm transition-colors border border-gold/30"
                >
                  <EffectDescription effect={option} state={gameState} />
                </button>
              ))}
            </>
          )}

          {/* Boutons choix de lieu a remplacer */}
          {isReplaceLocationPhase && pendingReplaceLocationChoice && (
            <>
              <button
                onClick={() => selectReplaceLocation('castle')}
                className="flex-1 py-3 px-4 rounded-xl bg-castle/30 hover:bg-castle/40 text-white font-medium text-sm transition-colors border border-castle/50"
              >
                <span>Chateau</span>
                {replaceLocationKeysGain.castle > 0 && (
                  <span className="ml-2 text-emerald-400">+{replaceLocationKeysGain.castle} <KeyIcon className="w-4 h-4 inline" /></span>
                )}
              </button>
              <button
                onClick={() => selectReplaceLocation('village')}
                className="flex-1 py-3 px-4 rounded-xl bg-village/40 hover:bg-village/50 text-white font-medium text-sm transition-colors border border-village/50"
              >
                <span>Village</span>
                {replaceLocationKeysGain.village > 0 && (
                  <span className="ml-2 text-emerald-400">+{replaceLocationKeysGain.village} <KeyIcon className="w-4 h-4 inline" /></span>
                )}
              </button>
            </>
          )}

          {/* Bouton confirmer selection bourses */}
          {isPurseSelectionPhase && pendingPurseSelectionChoice && (
            <button
              onClick={confirmPurseSelection}
              disabled={selectedPursePositions.length === 0}
              className="flex-1 py-3 px-4 rounded-xl bg-gold text-dark font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Confirmer ({selectedPursePositions.length}/{pendingPurseSelectionChoice.maxCards})
            </button>
          )}

          {/* Bouton terminer tour */}
          {!isCurrentPlayerAI() && canEndTurn && !isEffectPhase && !isReplaceLocationPhase && !isPurseSelectionPhase && (
            <button
              onClick={handleEndTurn}
              className="flex-1 py-3 px-4 rounded-xl bg-gold text-dark font-semibold"
            >
              Terminer le tour
            </button>
          )}
        </div>

        {/* Barre de statut */}
        <div className="px-3 py-2 text-center text-sm border-t border-white/5">
          {state.aiThinking && (
            <span className="text-gold animate-pulse">L'IA réfléchit...</span>
          )}
          {!state.aiThinking && isEffectPhase && !isCurrentPlayerAI() && (
            <span className="text-gold">Choisissez un effet</span>
          )}
          {!state.aiThinking && isDiscardPhase && !isCurrentPlayerAI() && (
            <span className="text-gold">
              Cliquez sur une carte du {pendingDiscardChoice?.location === 'castle' ? 'château' : 'village'} à défausser
            </span>
          )}
          {!state.aiThinking && isReplaceLocationPhase && !isCurrentPlayerAI() && (
            <span className="text-gold">Choisissez un lieu à remplacer</span>
          )}
          {!state.aiThinking && isAdjacentCardPhase && !isCurrentPlayerAI() && (
            <span className="text-gold">Cliquez sur une carte adjacente à activer</span>
          )}
          {!state.aiThinking && isPurseSelectionPhase && !isCurrentPlayerAI() && (
            <span className="text-gold">
              Sélectionnez jusqu'à {pendingPurseSelectionChoice?.maxCards ?? 2} bourse{(pendingPurseSelectionChoice?.maxCards ?? 2) > 1 ? 's' : ''} à remplir
            </span>
          )}
          {!state.aiThinking && isBuyPhase && !isCurrentPlayerAI() && (
            <span className="text-white/60">Cliquez sur une carte pour l'acheter</span>
          )}
          {!state.aiThinking && isPlacePhase && !isCurrentPlayerAI() && (
            <span className="text-gold">Placez la carte sur votre plateau</span>
          )}
          {!state.aiThinking && canEndTurn && !isCurrentPlayerAI() && !isEffectPhase && !isDiscardPhase && !isReplaceLocationPhase && !isAdjacentCardPhase && !isPurseSelectionPhase && (
            <span className="text-white/60">Terminez votre tour</span>
          )}
          {!state.aiThinking && isCurrentPlayerAI() && !canEndTurn && (
            <span className="text-white/40">Tour de l'IA</span>
          )}
        </div>
      </footer>

      {/* Quit confirmation */}
      <ConfirmDialog
        isOpen={showQuitConfirm}
        title="Quitter la partie ?"
        message="La partie ne sera pas sauvegardée."
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
