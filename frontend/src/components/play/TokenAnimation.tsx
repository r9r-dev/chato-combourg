/**
 * TokenAnimation - Animations de jetons pour les gains/pertes de ressources
 *
 * Affiche des jetons animés (pièces en bas à gauche, clés en bas à droite)
 * avec différents effets d'apparition/disparition.
 */

import { useState, useRef, useCallback } from 'react';

// Types d'animation disponibles
export type GainAnimation = 'pop-in' | 'slide-down' | 'fade-in';
export type LossAnimation = 'burn' | 'fall' | 'shrink' | 'shred';
export type AnimationSpeed = 'slow' | 'medium' | 'fast';

// Mapping vitesse -> durée en ms
const SPEED_DURATIONS: Record<AnimationSpeed, number> = {
  slow: 2500,
  medium: 1800,
  fast: 800,
};

// Délai de base entre chaque token (ms) + variance
const STAGGER_BASE_DELAY = 150;
const STAGGER_VARIANCE = 80;

// Images des jetons
const TOKEN_IMAGES = {
  key1: '/ccombo_jeton_cle_1.webp',
  key3: '/ccombo_jeton_cle_3.webp',
  coin1: '/ccombo_jeton_piece_1.webp',
  coin5: '/ccombo_jeton_piece_5.webp',
};

interface Token {
  id: number;
  type: 'gold' | 'keys';
  value: 1 | 3 | 5; // 1 ou 5 pour pièces, 1 ou 3 pour clés
  isGain: boolean;
  animation: GainAnimation | LossAnimation;
  speed: AnimationSpeed;
  position: { x: number; y: number }; // Position relative dans la zone
  delay: number; // Délai avant le début de l'animation (ms)
}

interface TokenAnimationProps {
  // Configuration des animations
  gainAnimation?: GainAnimation;
  lossAnimation?: LossAnimation;
  speed?: AnimationSpeed;
}

// Hook pour gérer les animations de tokens
export function useTokenAnimation(props?: TokenAnimationProps) {
  const {
    gainAnimation = 'pop-in',
    lossAnimation = 'burn',
    speed = 'medium',
  } = props || {};

  const [tokens, setTokens] = useState<Token[]>([]);
  const idCounterRef = useRef(0);

  // Ajouter des jetons pour un changement de ressource
  const triggerAnimation = useCallback(
    (type: 'gold' | 'keys', delta: number) => {
      if (delta === 0) return;

      // Créer un token avec position aléatoire et délai séquentiel
      const createToken = (
        tokenType: 'gold' | 'keys',
        value: 1 | 3 | 5,
        isGain: boolean,
        positionIndex: number,
        total: number,
        sequenceIndex: number
      ): Token => {
        // Répartir les jetons horizontalement - plage réduite pour peu d'éléments
        // 1 élément: centré à 50%
        // 2 éléments: 35%-65% (30% d'écart)
        // 3+ éléments: 25%-75% (50% d'écart)
        let baseX: number;
        if (total === 1) {
          baseX = 50;
        } else if (total === 2) {
          baseX = positionIndex === 0 ? 35 : 65;
        } else {
          // Pour 3+ éléments, répartir sur 50% de la largeur (25% à 75%)
          baseX = (positionIndex / (total - 1)) * 50 + 25;
        }
        const x = baseX + (Math.random() - 0.5) * 15;
        const y = 25 + Math.random() * 30;

        // Délai séquentiel avec variance aléatoire
        const variance = (Math.random() - 0.5) * 2 * STAGGER_VARIANCE;
        const delay = sequenceIndex * STAGGER_BASE_DELAY + variance;

        return {
          id: idCounterRef.current++,
          type: tokenType,
          value: value as 1 | 3 | 5,
          isGain,
          animation: isGain ? gainAnimation : lossAnimation,
          speed,
          position: { x, y },
          delay: Math.max(0, delay),
        };
      };

      const isGain = delta > 0;
      const absDelta = Math.abs(delta);
      const newTokens: Token[] = [];

      // Déterminer les jetons à afficher (gros jetons en premier)
      let sequenceIndex = 0;

      if (type === 'gold') {
        // Utiliser des pièces de 5 et 1
        const fives = Math.floor(absDelta / 5);
        const ones = absDelta % 5;
        const total = fives + ones;

        // D'abord les pièces de 5
        for (let i = 0; i < fives; i++) {
          newTokens.push(createToken('gold', 5, isGain, i, total, sequenceIndex++));
        }
        // Puis les pièces de 1
        for (let i = 0; i < ones; i++) {
          newTokens.push(createToken('gold', 1, isGain, fives + i, total, sequenceIndex++));
        }
      } else {
        // Utiliser des clés de 3 et 1
        const threes = Math.floor(absDelta / 3);
        const ones = absDelta % 3;
        const total = threes + ones;

        // D'abord les clés de 3
        for (let i = 0; i < threes; i++) {
          newTokens.push(createToken('keys', 3, isGain, i, total, sequenceIndex++));
        }
        // Puis les clés de 1
        for (let i = 0; i < ones; i++) {
          newTokens.push(createToken('keys', 1, isGain, threes + i, total, sequenceIndex++));
        }
      }

      setTokens((prev) => [...prev, ...newTokens]);

      // Supprimer après l'animation (durée + délai max + marge)
      const duration = SPEED_DURATIONS[speed];
      const maxDelay = Math.max(...newTokens.map((t) => t.delay));
      const ids = newTokens.map((t) => t.id);
      setTimeout(() => {
        setTokens((prev) => prev.filter((t) => !ids.includes(t.id)));
      }, duration + maxDelay + 100);
    },
    [gainAnimation, lossAnimation, speed]
  );

  return { tokens, triggerAnimation };
}

// Composant de rendu des tokens
interface TokenDisplayProps {
  tokens: Token[];
}

export function TokenDisplay({ tokens }: TokenDisplayProps) {
  const goldTokens = tokens.filter((t) => t.type === 'gold');
  const keyTokens = tokens.filter((t) => t.type === 'keys');

  return (
    <>
      {/* Zone des pièces - bas gauche */}
      <div className="fixed bottom-20 left-4 w-32 h-32 pointer-events-none z-50">
        {goldTokens.map((token) => (
          <TokenItem key={token.id} token={token} />
        ))}
      </div>

      {/* Zone des clés - bas droite */}
      <div className="fixed bottom-20 right-4 w-32 h-32 pointer-events-none z-50">
        {keyTokens.map((token) => (
          <TokenItem key={token.id} token={token} />
        ))}
      </div>
    </>
  );
}

// Taille des jetons en pixels selon leur valeur
const TOKEN_SIZES: Record<string, number> = {
  gold_1: 48,   // Pièce de 1 : -15%
  gold_5: 56,   // Pièce de 5 : taille de base
  keys_1: 56,   // Clé de 1 : taille de base
  keys_3: 64,   // Clé de 3 : +15%
};

function getTokenSize(token: Token): number {
  const key = `${token.type}_${token.value}`;
  return TOKEN_SIZES[key] || 56;
}

// Nombre de confettis pour l'effet shred
const CONFETTI_COUNT = 6;

// Générer les propriétés aléatoires pour un confetti (chute vers le bas)
function generateConfettiProps(index: number) {
  // Légère dispersion horizontale seulement
  const tx = (Math.random() - 0.5) * 60;
  // Chute vers le bas avec variance
  const ty = 120 + Math.random() * 80;
  // Rotation modérée
  const rotation = (Math.random() - 0.5) * 360;
  // Délai échelonné pour l'effet de désintégration
  const delay = index * 30 + Math.random() * 50;

  return { tx, ty, rotation, delay };
}

// Rendu d'un token individuel
function TokenItem({ token }: { token: Token }) {
  const duration = SPEED_DURATIONS[token.speed];
  const imageSrc = getTokenImage(token);
  const animationClass = getAnimationClass(token);
  const size = getTokenSize(token);

  // Pour l'effet shred, on génère des confettis
  if (token.animation === 'shred') {
    return (
      <div
        className="absolute"
        style={{
          left: `${token.position.x}%`,
          top: `${token.position.y}%`,
          width: size,
          height: size,
        }}
      >
        {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
          const props = generateConfettiProps(i);
          const confettiSize = size * (0.3 + Math.random() * 0.25);

          return (
            <div
              key={i}
              className="absolute animate-token-shred"
              style={{
                width: confettiSize,
                height: confettiSize,
                left: '50%',
                top: '50%',
                animationDuration: `${duration}ms`,
                animationDelay: `${token.delay + props.delay}ms`,
                opacity: 0,
                willChange: 'transform, opacity',
                ['--tx' as string]: `${props.tx}px`,
                ['--ty' as string]: `${props.ty}px`,
                ['--rot' as string]: `${props.rotation}deg`,
              }}
            >
              <img
                src={imageSrc}
                alt=""
                style={{
                  width: confettiSize,
                  height: confettiSize,
                  objectFit: 'cover',
                  clipPath: `polygon(
                    ${Math.random() * 30}% ${Math.random() * 30}%,
                    ${70 + Math.random() * 30}% ${Math.random() * 30}%,
                    ${70 + Math.random() * 30}% ${70 + Math.random() * 30}%,
                    ${Math.random() * 30}% ${70 + Math.random() * 30}%
                  )`,
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`absolute ${animationClass}`}
      style={{
        left: `${token.position.x}%`,
        top: `${token.position.y}%`,
        width: size,
        height: size,
        animationDuration: `${duration}ms`,
        animationDelay: `${token.delay}ms`,
        opacity: 0,
        willChange: 'transform, opacity',
      }}
    >
      <img
        src={imageSrc}
        alt={`${token.type} ${token.value}`}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
        }}
        className="drop-shadow-lg"
      />
    </div>
  );
}

function getTokenImage(token: Token): string {
  if (token.type === 'gold') {
    return token.value === 5 ? TOKEN_IMAGES.coin5 : TOKEN_IMAGES.coin1;
  }
  return token.value === 3 ? TOKEN_IMAGES.key3 : TOKEN_IMAGES.key1;
}

function getAnimationClass(token: Token): string {
  const prefix = 'animate-token-';

  if (token.isGain) {
    switch (token.animation) {
      case 'pop-in':
        return `${prefix}pop-in`;
      case 'slide-down':
        return `${prefix}slide-down`;
      case 'fade-in':
        return `${prefix}fade-in`;
    }
  } else {
    switch (token.animation) {
      case 'burn':
        return `${prefix}burn`;
      case 'fall':
        return `${prefix}fall`;
      case 'shrink':
        return `${prefix}shrink`;
    }
  }

  return '';
}

// Export du composant principal pour usage simple
export function TokenAnimation(props: TokenAnimationProps) {
  const { tokens } = useTokenAnimation(props);
  return <TokenDisplay tokens={tokens} />;
}
