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
