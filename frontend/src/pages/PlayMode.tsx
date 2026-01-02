/**
 * PlayMode - Routeur pour le mode Jouer
 *
 * Gere la navigation entre :
 * - PlaySetup (configuration)
 * - Play (jeu)
 * - PlayResults (resultats)
 */

import { PlayProvider, usePlay } from '../context/PlayContext';
import { PlaySetup } from './PlaySetup';
import { Play } from './Play';
import { PlayResults } from './PlayResults';

function PlayModeContent() {
  const { state } = usePlay();

  switch (state.step) {
    case 'setup':
      return <PlaySetup />;

    case 'playing':
    case 'ai_thinking':
    case 'effect_choice':
    case 'discard_choice':
    case 'replace_location_choice':
    case 'adjacent_card_choice':
    case 'purse_selection_choice':
      return <Play />;

    case 'results':
      return <PlayResults />;

    default:
      return <PlaySetup />;
  }
}

export function PlayMode() {
  return (
    <PlayProvider>
      <PlayModeContent />
    </PlayProvider>
  );
}
