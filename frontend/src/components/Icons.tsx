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

// =============================================================================
// Icones d'avatars IA
// =============================================================================

/** Avatar IA Facile - Biberon */
export function AIEasyIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Tetine */}
      <ellipse cx="12" cy="3.5" rx="3" ry="2" fill="currentColor" opacity="0.7" />
      {/* Col du biberon */}
      <rect x="9" y="4" width="6" height="2" rx="0.5" />
      {/* Corps du biberon */}
      <path d="M8 6h8v13a3 3 0 01-3 3h-2a3 3 0 01-3-3V6z" />
      {/* Graduations */}
      <rect x="9" y="9" width="3" height="1" fill="white" opacity="0.5" />
      <rect x="9" y="12" width="4" height="1" fill="white" opacity="0.5" />
      <rect x="9" y="15" width="2" height="1" fill="white" opacity="0.5" />
      {/* Reflet */}
      <path d="M14 7v11a2 2 0 01-1 1.7V7h1z" fill="white" opacity="0.2" />
    </svg>
  );
}

/** Avatar IA Normale - Chateau */
export function AINormalIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Tour gauche */}
      <rect x="2" y="8" width="5" height="14" />
      <rect x="2" y="6" width="1.5" height="2" />
      <rect x="3.75" y="6" width="1.5" height="2" />
      <rect x="5.5" y="6" width="1.5" height="2" />
      {/* Tour droite */}
      <rect x="17" y="8" width="5" height="14" />
      <rect x="17" y="6" width="1.5" height="2" />
      <rect x="18.75" y="6" width="1.5" height="2" />
      <rect x="20.5" y="6" width="1.5" height="2" />
      {/* Corps central */}
      <rect x="7" y="12" width="10" height="10" />
      {/* Tour centrale */}
      <rect x="9" y="4" width="6" height="8" />
      <rect x="9" y="2" width="1.5" height="2" />
      <rect x="11.25" y="2" width="1.5" height="2" />
      <rect x="13.5" y="2" width="1.5" height="2" />
      {/* Porte */}
      <path d="M10 22v-5a2 2 0 114 0v5" fill="white" opacity="0.3" />
      {/* Fenetres */}
      <rect x="3.5" y="12" width="2" height="2" fill="white" opacity="0.3" />
      <rect x="18.5" y="12" width="2" height="2" fill="white" opacity="0.3" />
      <rect x="11" y="6" width="2" height="2" fill="white" opacity="0.3" />
    </svg>
  );
}

/** Avatar IA Difficile - Casque de chevalier */
export function AIHardIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Casque principal */}
      <path d="M4 10c0-4.4 3.6-8 8-8s8 3.6 8 8v6c0 2.2-1.8 4-4 4h-8c-2.2 0-4-1.8-4-4v-6z" />
      {/* Visiere avec fentes */}
      <path d="M6 12h12v5a2 2 0 01-2 2H8a2 2 0 01-2-2v-5z" fill="white" opacity="0.15" />
      {/* Fentes de vision */}
      <rect x="7" y="13" width="4" height="1.5" rx="0.5" fill="black" opacity="0.6" />
      <rect x="13" y="13" width="4" height="1.5" rx="0.5" fill="black" opacity="0.6" />
      {/* Grille de ventilation */}
      <rect x="9" y="16" width="6" height="0.8" fill="black" opacity="0.4" />
      <rect x="9" y="17.5" width="6" height="0.8" fill="black" opacity="0.4" />
      {/* Crete/plume */}
      <path d="M12 2c0 0-1-1-1-1.5s.5-.5 1-.5.5 0 1 .5S12 2 12 2z" />
      <rect x="11" y="1" width="2" height="3" rx="1" />
      {/* Reflet */}
      <path d="M6 8c2-2 5-3 8-2" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}

/** Avatar IA Extreme - Tete de barbare enrage */
export function AIExtremeIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Cheveux/criniere sauvage */}
      <path d="M4 8c-1-3 1-5 3-6 1 2 2 1 3-1 1 2 3 2 4 0 1 2 2 3 3 1 2 1 4 3 3 6" />
      <path d="M3 9c-1 0-2 2-1 4l2-1c0-2 0-3-1-3z" />
      <path d="M21 9c1 0 2 2 1 4l-2-1c0-2 0-3 1-3z" />
      {/* Visage */}
      <ellipse cx="12" cy="14" rx="7" ry="8" />
      {/* Sourcils fronces */}
      <path d="M6 11l4 2" fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <path d="M18 11l-4 2" fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* Yeux furieux */}
      <ellipse cx="9" cy="13" rx="1.5" ry="1" fill="black" opacity="0.8" />
      <ellipse cx="15" cy="13" rx="1.5" ry="1" fill="black" opacity="0.8" />
      <circle cx="9" cy="13" r="0.5" fill="white" />
      <circle cx="15" cy="13" r="0.5" fill="white" />
      {/* Nez */}
      <path d="M12 14v2" fill="none" stroke="black" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      {/* Bouche hurlante */}
      <path d="M8 18c1 2 6 2 8 0" fill="black" opacity="0.7" />
      <path d="M9 18v1.5M11 18v2M13 18v2M15 18v1.5" fill="none" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      {/* Cicatrice */}
      <path d="M16 10l2 4" fill="none" stroke="black" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

// =============================================================================
// Icones du menu Play
// =============================================================================

/** Icone menu hamburger */
export function MenuIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

/** Icone loupe (recherche) */
export function SearchIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

/** Icone defausse (pile de cartes avec fleche) */
export function DiscardIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Cartes empilees */}
      <rect x="3" y="5" width="12" height="16" rx="1" />
      <rect x="6" y="3" width="12" height="16" rx="1" fill="currentColor" fillOpacity="0.1" />
      {/* Fleche vers le bas */}
      <path d="M18 10v8m0 0l-3-3m3 3l3-3" strokeWidth="2.5" />
    </svg>
  );
}

/** Icone repartition des blasons (boucliers groupes) */
export function ShieldDistIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Bouclier central */}
      <path d="M12 2L6 5v4c0 4 2.4 7.7 6 8.6 3.6-.9 6-4.6 6-8.6V5l-6-3z" fill="#3b82f6" />
      <path d="M12 3.5L7.5 6v3.5c0 3.2 1.9 6.2 4.5 7V3.5z" fill="white" fillOpacity="0.2" />
      {/* Mini bouclier gauche */}
      <path d="M4 14l-2.5 1.5v2c0 2 1.2 3.8 2.5 4.3 1.3-.5 2.5-2.3 2.5-4.3v-2L4 14z" fill="#ec4899" opacity="0.8" />
      {/* Mini bouclier droit */}
      <path d="M20 14l-2.5 1.5v2c0 2 1.2 3.8 2.5 4.3 1.3-.5 2.5-2.3 2.5-4.3v-2L20 14z" fill="#22c55e" opacity="0.8" />
    </svg>
  );
}

/** Icone aide (point d'interrogation) */
export function HelpIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 9a3 3 0 115.12 2.12c-.58.59-1.62 1.38-1.62 2.38" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

/** Icone regles (livre/parchemin) */
export function RulesIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" />
      {/* Lignes de texte */}
      <path d="M8 7h8M8 11h6M8 15h4" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

/** Icone recommencer (fleche circulaire) */
export function RestartIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

/** Icone quitter (porte avec fleche) */
export function QuitIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Porte */}
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      {/* Fleche */}
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
