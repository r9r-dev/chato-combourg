/**
 * Hook pour gérer le mode legacy (import d'anciennes parties).
 *
 * Ce hook encapsule la logique spécifique au mode legacy :
 * - Saisie des scores individuels par carte
 * - Sauvegarde des joueurs en mode legacy
 * - Sauvegarde de la partie complète
 */

import { useCallback } from 'react';
import type {
  GameState,
  SelectedPlayer,
  LegacyPlayerCreate,
  GameDetail,
} from '../types';
import { createLegacyGame } from '../services/api';
import type { GameAction } from '../context/gameReducer';

interface UseLegacyModeOptions {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

interface UseLegacyModeReturn {
  /** Active ou désactive le mode legacy */
  setLegacyMode: (isLegacy: boolean) => void;
  /** Met à jour les scores des 9 cartes */
  setLegacyCardScores: (scores: number[]) => void;
  /** Sauvegarde le joueur courant et passe au suivant. Retourne true s'il reste des joueurs */
  saveLegacyPlayerAndNext: () => Promise<boolean>;
  /** Sauvegarde la partie complète (tous les joueurs) */
  saveLegacyGame: () => Promise<GameDetail | null>;
}

export function useLegacyMode({ state, dispatch }: UseLegacyModeOptions): UseLegacyModeReturn {
  const setLegacyMode = useCallback(
    (isLegacy: boolean) => {
      dispatch({ type: 'SET_LEGACY_MODE', isLegacy });
    },
    [dispatch]
  );

  const setLegacyCardScores = useCallback(
    (scores: number[]) => {
      dispatch({ type: 'SET_LEGACY_CARD_SCORES', scores });
    },
    [dispatch]
  );

  const saveLegacyPlayerAndNext = useCallback(async (): Promise<boolean> => {
    const cardScores = state.legacyCardScores ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const totalScore = cardScores.reduce((sum, s) => sum + s, 0) + state.keys;

    // Sauvegarder le joueur courant
    dispatch({ type: 'SAVE_LEGACY_PLAYER', totalScore, cardScores });

    const nextIndex = state.currentPlayerIndex + 1;
    const hasMorePlayers = nextIndex < state.selectedPlayers.length;

    if (hasMorePlayers) {
      dispatch({ type: 'NEXT_PLAYER' });
      return true;
    }

    // Dernier joueur : sauvegarder la partie
    // Note : on doit récupérer les joueurs mis à jour après le dispatch
    // Pour cela, on utilise les données actuelles + le joueur qu'on vient de sauvegarder
    const updatedPlayers = [...state.selectedPlayers];
    updatedPlayers[state.currentPlayerIndex] = {
      ...updatedPlayers[state.currentPlayerIndex],
      keys: state.keys,
      legacyCardScores: cardScores,
    };

    try {
      const players: LegacyPlayerCreate[] = updatedPlayers.map((p) => ({
        player_id: p.id,
        keys: p.keys,
        card_scores: p.legacyCardScores ?? [0, 0, 0, 0, 0, 0, 0, 0, 0],
      }));
      await createLegacyGame({
        players,
        played_at: state.playedAt,
      });
    } catch (error) {
      console.error('Failed to save legacy game:', error);
    }

    // Aller au résumé
    dispatch({ type: 'NEXT_PLAYER' });
    dispatch({ type: 'SET_STEP', step: 'summary' });

    return false;
  }, [state.legacyCardScores, state.keys, state.currentPlayerIndex, state.selectedPlayers, state.playedAt, dispatch]);

  const saveLegacyGame = useCallback(async (): Promise<GameDetail | null> => {
    if (state.selectedPlayers.length < 2) return null;

    try {
      const players: LegacyPlayerCreate[] = state.selectedPlayers.map((p: SelectedPlayer) => ({
        player_id: p.id,
        keys: p.keys,
        card_scores: p.legacyCardScores ?? [0, 0, 0, 0, 0, 0, 0, 0, 0],
      }));

      return await createLegacyGame({
        players,
        played_at: state.playedAt,
      });
    } catch (error) {
      console.error('Failed to save legacy game:', error);
      return null;
    }
  }, [state.selectedPlayers, state.playedAt]);

  return {
    setLegacyMode,
    setLegacyCardScores,
    saveLegacyPlayerAndNext,
    saveLegacyGame,
  };
}
