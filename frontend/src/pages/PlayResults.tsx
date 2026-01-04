/**
 * PlayResults - Resultats de la partie
 *
 * Affiche le classement final avec les scores calcules via l'API.
 * Sauvegarde automatiquement la partie en base de donnees.
 */

import { useEffect, useRef, useState } from 'react';
import { usePlay } from '../context/PlayContext';
import { calculateScore, createGame, createPlayer, getPlayers } from '../services/api';
import { MiniGrid } from '../components/MiniGrid';
import { CoinStack } from '../components/Icons';
import type { PlayPlayer } from '../types/play';
import type { CalculateResponse, CardScoreDetail } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface PlayerResult {
  player: PlayPlayer;
  score: number;
  keysBonus: number;
  cardsScore: number;
  rank: number;
  cards: string[];
  details: CardScoreDetail[];
}

// Noms des joueurs IA par niveau
const AI_PLAYER_NAMES: Record<string, string> = {
  easy: 'Tom',
  normal: 'Bruce',
  hard: 'Celeste',
  neural: 'Elsa',
};

export function PlayResults() {
  const { state, reset } = usePlay();
  const gameState = state.gameState;

  const [results, setResults] = useState<PlayerResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const hasCalculatedRef = useRef(false);
  const hasSavedRef = useRef(false);

  // Calculer les vrais scores via l'API
  useEffect(() => {
    if (!gameState || hasCalculatedRef.current) return;
    hasCalculatedRef.current = true;

    async function calculateScores() {
      setIsCalculating(true);

      const playerResults: PlayerResult[] = [];

      for (const player of gameState!.players) {
        // Extraire les cartes du plateau (positions 0-8)
        const cards: string[] = [];
        for (let i = 0; i < 9; i++) {
          const placed = player.board[i];
          cards.push(placed?.cardId ?? '');
        }

        // Compter les pieces sur les bourses + les pieces restantes en main
        // A la fin de la partie, le joueur peut remplir ses bourses avec ses pieces restantes
        const coinsOnCards = player.board.reduce((sum, card) => {
          return sum + (card?.coinsOnCard ?? 0);
        }, 0);
        const totalCoins = coinsOnCards + player.gold;

        // Calculer le score via l'API si le plateau est complet
        const hasAllCards = cards.every(c => c !== '');
        let scoreResult: CalculateResponse | null = null;

        if (hasAllCards) {
          try {
            scoreResult = await calculateScore({
              cards,
              keys: player.keys,
              total_coins: totalCoins,
            });
          } catch (error) {
            console.error(`Failed to calculate score for ${player.name}:`, error);
          }
        }

        // Utiliser le score calcule ou un score simplifie
        const score = scoreResult?.total_score ?? (
          player.board.filter(c => c !== null).length * 5 + player.gold + player.keys * 3
        );

        playerResults.push({
          player,
          score,
          keysBonus: scoreResult?.keys_bonus ?? player.keys,
          cardsScore: scoreResult?.cards_score ?? 0,
          rank: 0,
          cards,
          details: scoreResult?.details ?? [],
        });
      }

      // Trier par score decroissant
      playerResults.sort((a, b) => b.score - a.score);

      // Attribuer les rangs
      playerResults.forEach((result, index) => {
        if (index === 0) {
          result.rank = 1;
        } else if (result.score === playerResults[index - 1].score) {
          result.rank = playerResults[index - 1].rank;
        } else {
          result.rank = index + 1;
        }
      });

      setResults(playerResults);
      setIsCalculating(false);
    }

    calculateScores();
  }, [gameState]);

  // Sauvegarder la partie une fois les scores calcules
  useEffect(() => {
    if (isCalculating || results.length === 0 || hasSavedRef.current) return;
    hasSavedRef.current = true;

    async function savePlayGame() {
      setIsSaving(true);
      setSaveError(null);

      try {
        // Recuperer les joueurs existants pour voir si les joueurs IA existent deja
        const existingPlayers = await getPlayers();
        const playerIdMap = new Map<string, number>();

        // Creer un mapping des joueurs IA existants (par nom)
        for (const player of existingPlayers) {
          // Utiliser is_ai flag ou fallback sur le nom pour compatibilite
          if (player.is_ai || Object.values(AI_PLAYER_NAMES).includes(player.name)) {
            playerIdMap.set(player.name, player.id);
          }
        }

        // Preparer les donnees des joueurs pour la sauvegarde
        const playersData: {
          player_id: number;
          keys: number;
          coins: number;
          cards: string[];
          score: number;
        }[] = [];

        for (const result of results) {
          let playerId: number;

          if (result.player.isAI) {
            // Joueur IA - creer ou reutiliser
            const aiName = AI_PLAYER_NAMES[result.player.aiLevel ?? 'normal'] ?? 'IA';

            if (playerIdMap.has(aiName)) {
              playerId = playerIdMap.get(aiName)!;
            } else {
              // Creer le joueur IA avec is_ai = true
              const newPlayer = await createPlayer(aiName, true);
              playerId = newPlayer.id;
              playerIdMap.set(aiName, playerId);
            }
          } else {
            // Joueur humain - utiliser son ID existant
            if (!result.player.playerId) {
              console.error(`Human player ${result.player.name} has no playerId`);
              continue;
            }
            playerId = result.player.playerId;
          }

          // Compter les pieces sur les bourses + les pieces restantes en main
          const coinsOnCards = result.player.board.reduce((sum, card) => {
            return sum + (card?.coinsOnCard ?? 0);
          }, 0);
          const totalCoins = coinsOnCards + result.player.gold;

          playersData.push({
            player_id: playerId,
            keys: result.player.keys,
            coins: totalCoins,
            cards: result.cards.filter(c => c !== ''),
            score: result.score,
          });
        }

        // Verifier qu'on a au moins 2 joueurs
        if (playersData.length < 2) {
          setSaveError('Impossible de sauvegarder: pas assez de joueurs');
          setIsSaving(false);
          return;
        }

        // Sauvegarder la partie
        await createGame({
          players: playersData,
          source: 'application',
        });

        setIsSaved(true);
      } catch (error) {
        console.error('Failed to save game:', error);
        setSaveError(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde');
      } finally {
        setIsSaving(false);
      }
    }

    savePlayGame();
  }, [isCalculating, results]);

  const winner = results[0];

  if (!gameState || isCalculating) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh gap-4">
        <div className="animate-spin w-8 h-8 border-4 border-gold border-t-transparent rounded-full" />
        <div className="text-white/60">Calcul des scores...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-white/60">Aucun résultat</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-dark">
      {/* Header */}
      <header className="p-4 border-b border-white/10 text-center">
        <h1 className="text-2xl font-bold text-gold">Partie terminée !</h1>
        {isSaving && (
          <p className="text-white/40 text-sm mt-1">Sauvegarde en cours...</p>
        )}
        {isSaved && (
          <p className="text-green-400 text-sm mt-1">Partie sauvegardée ✓</p>
        )}
        {saveError && (
          <p className="text-red-400 text-sm mt-1">{saveError}</p>
        )}
      </header>

      {/* Winner */}
      <div className="p-6 text-center border-b border-white/10">
        <div className="inline-flex items-center gap-3 mb-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: winner.player.color }}
          >
            {winner.player.isAI ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 7H7v6h6V7z" />
                <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
              </svg>
            ) : (
              '1'
            )}
          </div>
        </div>
        <h2 className="text-xl font-semibold text-white">{winner.player.name}</h2>
        <p className="text-gold text-3xl font-bold mt-1">{winner.score} pts</p>
      </div>

      {/* Classement */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {results.map((result, index) => (
            <div
              key={result.player.id}
              className={`flex items-center gap-4 p-4 rounded-xl ${
                index === 0 ? 'bg-gold/20 border border-gold' : 'bg-dark-lighter'
              }`}
            >
              {/* Rang */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                result.rank === 1 ? 'bg-gold text-dark' :
                result.rank === 2 ? 'bg-gray-400 text-dark' :
                result.rank === 3 ? 'bg-orange-700 text-white' :
                'bg-dark text-white/60'
              }`}>
                {result.rank}
              </div>

              {/* Joueur */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: result.player.color }}
              >
                {result.player.isAI ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 7H7v6h6V7z" />
                    <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                  </svg>
                ) : (
                  result.player.name.charAt(0).toUpperCase()
                )}
              </div>

              {/* Nom et stats */}
              <div className="flex-1">
                <span className="text-white font-medium">{result.player.name}</span>
                <div className="flex gap-3 text-xs text-white/40 mt-0.5">
                  <span>{result.player.board.filter(c => c !== null).length} cartes</span>
                  <span>{result.player.gold} or</span>
                  <span>{result.player.keys} clés</span>
                </div>
              </div>

              {/* Score */}
              <div className="text-right">
                <span className={`text-xl font-bold ${index === 0 ? 'text-gold' : 'text-white'}`}>
                  {result.score}
                </span>
                <span className="text-white/40 text-sm ml-1">pts</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tableau récapitulatif des scores */}
        <div className="mt-6">
          <h3 className="text-white/60 text-sm mb-3">Détail des scores</h3>
          <div className="rounded-xl bg-dark-lighter border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                {/* Header avec noms des joueurs */}
                <thead>
                  <tr>
                    <th className="p-2 w-10" />
                    {results.map((result) => {
                      const isWinner = result.rank === 1;
                      return (
                        <th key={result.player.id} className="p-2 text-center min-w-[60px]">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                isWinner ? 'ring-2 ring-gold' : ''
                              }`}
                              style={{ backgroundColor: result.player.color }}
                            >
                              {result.player.isAI ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M13 7H7v6h6V7z" />
                                  <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                result.player.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span
                              className={`text-xs font-medium truncate max-w-[80px] ${
                                isWinner ? 'text-gold' : 'text-white/80'
                              }`}
                            >
                              {result.player.name}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {/* 9 lignes de positions de cartes */}
                  {Array.from({ length: 9 }).map((_, position) => (
                    <tr
                      key={position}
                      className={position % 2 === 0 ? 'bg-white/5' : ''}
                    >
                      <td className="p-2 border-r border-white/10">
                        <MiniGrid position={position} size={20} />
                      </td>
                      {results.map((result) => {
                        const detail = result.details.find((d) => d.position === position);
                        const score = detail?.score ?? '-';
                        return (
                          <td
                            key={result.player.id}
                            className="p-2 text-center font-mono text-white/90"
                          >
                            {score}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Ligne bonus clés */}
                  <tr className="border-t border-gold/30 bg-gold/10">
                    <td className="p-2 border-r border-white/10">
                      <div className="flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-gold"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                        </svg>
                      </div>
                    </td>
                    {results.map((result) => (
                      <td
                        key={result.player.id}
                        className="p-2 text-center font-mono text-gold"
                      >
                        {result.keysBonus}
                      </td>
                    ))}
                  </tr>

                  {/* Ligne total */}
                  <tr className="border-t-2 border-gold bg-gold/20">
                    <td className="p-2 border-r border-white/10">
                      <div className="flex items-center justify-center text-gold font-bold text-lg">
                        &Sigma;
                      </div>
                    </td>
                    {results.map((result) => {
                      const isWinner = result.rank === 1;
                      return (
                        <td
                          key={result.player.id}
                          className={`p-2 text-center font-mono font-bold text-xl ${
                            isWinner ? 'text-gold' : 'text-white'
                          }`}
                        >
                          {result.score}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Plateaux des joueurs */}
        <div className="mt-6">
          <h3 className="text-white/60 text-sm mb-3">Plateaux finaux</h3>
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.player.id} className="bg-dark-lighter rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: result.player.color }}
                  />
                  <span className="text-white text-sm">{result.player.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {result.player.board.map((card, i) => {
                    // Utiliser les pièces retournées par l'API (inclut les pièces restantes distribuées)
                    const detail = result.details.find((d) => d.position === i);
                    const coinsOnCard = detail?.coins ?? card?.coinsOnCard ?? 0;

                    return (
                      <div key={i} className="aspect-[5/7] rounded overflow-hidden bg-dark/50 relative">
                        {card && (
                          <>
                            <img
                              src={`${API_BASE}/cards/thumbs/carte_${card.cardId}.webp`}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {coinsOnCard > 0 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none rounded" style={{ paddingBottom: '20%' }}>
                                <CoinStack count={coinsOnCard} seed={i} className="scale-50" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 border-t border-white/10">
        <button
          onClick={reset}
          className="w-full py-4 px-8 bg-gold text-dark font-semibold text-lg rounded-xl
                     hover:bg-gold-light active:bg-gold-dark transition-colors"
        >
          Nouvelle partie
        </button>
      </footer>
    </div>
  );
}
