/**
 * TokenNotification - Notifications visuelles de changement de ressources
 *
 * Affiche des jetons animés quand les ressources (or/clés) changent.
 * - Gains: animation slide-up depuis le bas
 * - Pertes: animation fall (chute)
 * - Pièces en bas à gauche, clés en bas à droite
 */

import { useEffect, useRef } from 'react';
import { TokenDisplay, useTokenAnimation } from './TokenAnimation';

interface TokenNotificationProps {
  gold: number;
  keys: number;
  playerId: string;
}

export function TokenNotification({ gold, keys, playerId }: TokenNotificationProps) {
  const { tokens, triggerAnimation } = useTokenAnimation({
    gainAnimation: 'slide-down', // slide-down utilise slide-up via l'alias CSS
    lossAnimation: 'fall',
    speed: 'medium', // 1.8s
  });

  const prevValuesRef = useRef<{ gold: number; keys: number; playerId: string }>({
    gold,
    keys,
    playerId,
  });

  useEffect(() => {
    const prev = prevValuesRef.current;

    // Si le joueur change, on ne montre pas d'animation
    if (prev.playerId !== playerId) {
      prevValuesRef.current = { gold, keys, playerId };
      return;
    }

    // Changement d'or
    const goldDelta = gold - prev.gold;
    if (goldDelta !== 0) {
      triggerAnimation('gold', goldDelta);
    }

    // Changement de clés
    const keysDelta = keys - prev.keys;
    if (keysDelta !== 0) {
      triggerAnimation('keys', keysDelta);
    }

    prevValuesRef.current = { gold, keys, playerId };
  }, [gold, keys, playerId, triggerAnimation]);

  return <TokenDisplay tokens={tokens} />;
}
