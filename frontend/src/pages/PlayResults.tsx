/**
 * PlayResults - Resultats de la partie
 *
 * Affiche le classement final avec les scores calcules.
 */

import { useMemo } from 'react';
import { usePlay } from '../context/PlayContext';
import type { PlayPlayer } from '../types/play';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface PlayerResult {
  player: PlayPlayer;
  score: number;
  rank: number;
}

export function PlayResults() {
  const { state, reset } = usePlay();
  const gameState = state.gameState;

  // Calculer les scores (simplifie - compte les cartes et ressources)
  const results = useMemo((): PlayerResult[] => {
    if (!gameState) return [];

    const playerScores = gameState.players.map((player) => {
      // Score simplifie pour demo
      // TODO: Utiliser l'API /api/calculate pour les vrais scores
      const cardCount = player.board.filter(c => c !== null).length;
      const score = cardCount * 5 + player.gold + player.keys * 3;

      return {
        player,
        score,
        rank: 0,
      };
    });

    // Trier par score decroissant
    playerScores.sort((a, b) => b.score - a.score);

    // Attribuer les rangs
    playerScores.forEach((result, index) => {
      if (index === 0) {
        result.rank = 1;
      } else if (result.score === playerScores[index - 1].score) {
        result.rank = playerScores[index - 1].rank;
      } else {
        result.rank = index + 1;
      }
    });

    return playerScores;
  }, [gameState]);

  const winner = results[0];

  if (!gameState || results.length === 0) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-white/60">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-dark">
      {/* Header */}
      <header className="p-4 border-b border-white/10 text-center">
        <h1 className="text-2xl font-bold text-gold">Partie terminee !</h1>
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
                  <span>{result.player.keys} cles</span>
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
                  {result.player.board.map((card, i) => (
                    <div key={i} className="aspect-[5/7] rounded overflow-hidden bg-dark/50">
                      {card && (
                        <img
                          src={`${API_BASE}/cards/thumbs/carte_${card.cardId}.webp`}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                  ))}
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
