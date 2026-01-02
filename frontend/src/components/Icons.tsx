/**
 * Icons - Banque de symboles partages
 *
 * Centralise les icones reutilisables dans l'application.
 */

interface IconProps {
  className?: string;
}

/** Icone achat (panier/sac) */
export function BuyIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6h15l-1.5 9h-12z" />
      <circle cx="9" cy="20" r="1" fill="currentColor" />
      <circle cx="18" cy="20" r="1" fill="currentColor" />
      <path d="M6 6L5 3H2" />
    </svg>
  );
}

/** Icone placement (grille avec fleche) */
export function PlaceIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" opacity="0.3" />
      <path d="M17.5 14v4m0 0l-2-2m2 2l2-2" strokeWidth="2.5" />
    </svg>
  );
}

/** Icone effet (eclair/magie) */
export function EffectIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

/** Icone piece d'or medievale avec fleur de lys */
export function CoinIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <defs>
        {/* Degrade dore realiste */}
        <linearGradient id="coinGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="30%" stopColor="#daa520" />
          <stop offset="50%" stopColor="#b8860b" />
          <stop offset="70%" stopColor="#daa520" />
          <stop offset="100%" stopColor="#ffd700" />
        </linearGradient>
        {/* Ombre interieure pour relief */}
        <radialGradient id="coinShadow" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="black" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      {/* Piece principale */}
      <circle cx="12" cy="12" r="10" fill="url(#coinGold)" />
      {/* Relief/ombre */}
      <circle cx="12" cy="12" r="10" fill="url(#coinShadow)" />
      {/* Bordure decorative */}
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="#b8860b" strokeWidth="0.5" strokeOpacity="0.6" />
      {/* Fleur de lys gravee */}
      <g transform="translate(12, 12) scale(0.35)" fill="#78350f" fillOpacity="0.7">
        {/* Petale central */}
        <path d="M0,-12 C3,-8 3,-4 0,0 C-3,-4 -3,-8 0,-12" />
        {/* Petale gauche */}
        <path d="M-8,-6 C-6,-4 -4,-2 -2,0 C-4,0 -7,-1 -8,-6" />
        {/* Petale droit */}
        <path d="M8,-6 C6,-4 4,-2 2,0 C4,0 7,-1 8,-6" />
        {/* Base */}
        <path d="M-3,0 L-2,6 L0,4 L2,6 L3,0 C2,2 -2,2 -3,0" />
      </g>
    </svg>
  );
}

interface CoinStackProps {
  count: number;
  seed?: number; // Pour la variance visuelle
  className?: string;
}

// Positions de base pour les pièces de 1 (relatives au centre)
// Index = nombre de pièces de 1 - 1
const ONES_POSITIONS: Array<Array<{ x: number; y: number }>> = [
  // 1 pièce : centre
  [{ x: 0, y: 0 }],
  // 2 pièces : diagonale
  [{ x: -8, y: 6 }, { x: 8, y: -6 }],
  // 3 pièces : triangle
  [{ x: 0, y: -8 }, { x: -9, y: 6 }, { x: 9, y: 6 }],
  // 4 pièces : carré écarté
  [{ x: -10, y: -8 }, { x: 10, y: -8 }, { x: -10, y: 8 }, { x: 10, y: 8 }],
];

// Décalage des pièces de 1 quand il y a une pièce de 5 en dessous
const ONES_OFFSET_WITH_FIVE = { x: 2, y: -2 };

/**
 * Pile de pieces avec denominations de 5 (or) et 1 (bronze).
 * Empilement organique avec variance visuelle.
 */
export function CoinStack({ count, seed = 0, className = '' }: CoinStackProps) {
  if (count <= 0) return null;

  const hasFive = count >= 5;
  const ones = count % 5;

  // Générateur pseudo-aléatoire simple basé sur le seed
  const variance = (index: number, axis: 'x' | 'y') => {
    const hash = Math.sin(seed * 9999 + index * 7 + (axis === 'x' ? 0 : 100)) * 10000;
    return (hash - Math.floor(hash)) * 12 - 6; // Variance de -6 à +6 pixels
  };

  // Variance de rotation
  const rotationVariance = (index: number) => {
    const hash = Math.sin(seed * 1234 + index * 13) * 10000;
    return (hash - Math.floor(hash)) * 30 - 15; // Rotation de -15 à +15 degrés
  };

  // Calculer les positions des pièces de 1
  const onesPositions = ones > 0 ? ONES_POSITIONS[ones - 1] : [];

  return (
    <div className={`relative w-16 h-16 ${className}`}>
      {/* Pièce de 5 (argent) en fond */}
      {hasFive && (
        <div
          className="absolute flex items-center justify-center rounded-full font-extrabold border-2
            w-12 h-12 border-slate-400"
          style={{
            left: '50%',
            top: '50%',
            // Décaler vers le haut si des pièces de 1 sont présentes
            transform: `translate(-50%, -50%) translate(${variance(0, 'x')}px, ${variance(0, 'y') + (ones > 0 ? -8 : 0)}px) rotate(${rotationVariance(0)}deg)`,
            zIndex: 1,
            background: 'linear-gradient(145deg, #e8e8e8 0%, #c0c0c0 30%, #a8a8a8 50%, #c0c0c0 70%, #d8d8d8 100%)',
            boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.6), inset -2px -2px 4px rgba(0,0,0,0.2), 2px 2px 6px rgba(0,0,0,0.3)',
            fontSize: '2.25rem',
            color: '#374151',
            textShadow: '1px 1px 0 rgba(255,255,255,0.5), -1px -1px 0 rgba(0,0,0,0.2)',
          }}
        >
          5
        </div>
      )}
      {/* Pièces de 1 (or) empilées */}
      {onesPositions.map((pos, i) => {
        const baseX = hasFive ? pos.x * 0.7 + ONES_OFFSET_WITH_FIVE.x : pos.x;
        const baseY = hasFive ? pos.y * 0.7 + ONES_OFFSET_WITH_FIVE.y : pos.y;
        const vx = variance(i + 1, 'x');
        const vy = variance(i + 1, 'y');
        const rot = rotationVariance(i + 1);

        return (
          <div
            key={i}
            className="absolute flex items-center justify-center rounded-full font-extrabold border-2
              w-8 h-8 border-yellow-600"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${baseX + vx}px, ${baseY + vy}px) rotate(${rot}deg)`,
              zIndex: 2 + i,
              background: 'linear-gradient(145deg, #ffd700 0%, #daa520 30%, #b8860b 50%, #daa520 70%, #ffd700 100%)',
              boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.5), inset -2px -2px 4px rgba(0,0,0,0.2), 2px 2px 6px rgba(0,0,0,0.3)',
              fontSize: '0.95rem',
              color: '#78350f',
              textShadow: '1px 1px 0 rgba(255,255,255,0.4), -1px -1px 0 rgba(0,0,0,0.15)',
            }}
          >
            1
          </div>
        );
      })}
    </div>
  );
}

/** Icone cle medievale */
export function KeyIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Tete de cle ornementee (trefle) - centree */}
      <circle cx="12" cy="6" r="4" />
      <circle cx="9" cy="3" r="2.2" />
      <circle cx="15" cy="3" r="2.2" />
      <circle cx="12" cy="1.3" r="1.8" />
      {/* Trou de la cle */}
      <circle cx="12" cy="6" r="1.5" className="text-dark" />
      {/* Tige */}
      <rect x="10.7" y="9" width="2.6" height="14" rx="0.5" />
      {/* Dents */}
      <rect x="13.3" y="15" width="4" height="2.2" rx="0.4" />
      <rect x="13.3" y="19" width="2.8" height="2.2" rx="0.4" />
    </svg>
  );
}

/** Couleurs des boucliers */
const SHIELD_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  pink: '#ec4899',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
};

interface ShieldIconProps {
  className?: string;
  color: 'blue' | 'pink' | 'green' | 'red' | 'orange' | 'yellow';
}

/** Icone bouclier colore */
export function ShieldIcon({ className = 'w-4 h-4', color }: ShieldIconProps) {
  const fillColor = SHIELD_COLORS[color] || '#9ca3af';
  return (
    <svg className={className} viewBox="0 0 24 24" fill={fillColor}>
      <path d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.4 4.6-1.25 8-6.15 8-11.4V6l-8-4z" />
      <path d="M12 4L6 7v5c0 4.2 2.7 8.12 6 9.14V4z" fill="white" fillOpacity="0.2" />
    </svg>
  );
}

/** Icone cadenas (pour les cartes avec effet cadenas) */
export function LockIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Corps du cadenas */}
      <rect x="4" y="10" width="16" height="12" rx="2" />
      {/* Anse du cadenas */}
      <path
        d="M8 10V7a4 4 0 118 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Trou de serrure */}
      <circle cx="12" cy="16" r="2" fill="white" fillOpacity="0.8" />
    </svg>
  );
}

/** Icone oeil barre (carte cachee) */
export function HiddenIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <path d="M1 1l22 22" />
      <circle cx="12" cy="12" r="3" opacity="0.5" />
    </svg>
  );
}

interface PositionGridProps {
  position: number; // 0-8
  size?: number;    // Taille en pixels (defaut 16)
  className?: string;
}

/**
 * Grille 3x3 SVG avec une position surlignee.
 * Utilise des SVG pour un rendu net a toutes les tailles.
 */
export function PositionGrid({ position, size = 16, className = '' }: PositionGridProps) {
  // Grille 3x3 : chaque cellule fait 6x6 avec gap de 1, total 20x20 viewBox
  const cellSize = 6;
  const gap = 1;

  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const x = col * (cellSize + gap);
      const y = row * (cellSize + gap);
      const isActive = idx === position;

      cells.push(
        <rect
          key={idx}
          x={x}
          y={y}
          width={cellSize}
          height={cellSize}
          rx={1}
          fill={isActive ? '#d4af37' : 'rgba(255,255,255,0.3)'}
        />
      );
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={className}
      aria-label={`Position ${position + 1}`}
    >
      {cells}
    </svg>
  );
}
