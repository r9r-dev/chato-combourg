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

/** Icone piece d'or */
export function CoinIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" className="text-gold" />
      <circle cx="12" cy="12" r="7" className="text-yellow-600" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

/** Icone cle */
export function KeyIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="3" />
      <path d="M10.5 10.5L21 21M18 18l2-2M18 21l2-2" />
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
