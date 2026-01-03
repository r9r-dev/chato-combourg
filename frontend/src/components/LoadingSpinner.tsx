/**
 * Composant de spinner de chargement réutilisable.
 * Style cohérent avec le thème dark/gold de l'application.
 */

interface LoadingSpinnerProps {
  /** Taille du spinner: 'sm' (16px), 'md' (32px), 'lg' (64px) */
  size?: 'sm' | 'md' | 'lg';
  /** Texte à afficher sous le spinner */
  text?: string;
  /** Sous-texte supplémentaire (plus petit, moins visible) */
  subtext?: string;
  /** Afficher en plein écran centré */
  fullScreen?: boolean;
  /** Couleur principale (défaut: gold) */
  color?: 'gold' | 'white';
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-16 h-16',
};

const innerSizeClasses = {
  sm: 'inset-1',
  md: 'inset-2',
  lg: 'inset-4',
};

const borderClasses = {
  sm: 'border-2',
  md: 'border-3',
  lg: 'border-4',
};

export function LoadingSpinner({
  size = 'md',
  text,
  subtext,
  fullScreen = false,
  color = 'gold',
}: LoadingSpinnerProps) {
  const colorClasses = {
    ring: color === 'gold' ? 'border-gold/30' : 'border-white/30',
    spin: color === 'gold' ? 'border-t-gold' : 'border-t-white',
    pulse: color === 'gold' ? 'bg-gold/50' : 'bg-white/50',
    text: color === 'gold' ? 'text-gold' : 'text-white',
  };

  const spinner = (
    <div className={`relative ${sizeClasses[size]}`}>
      {/* Outer ring */}
      <div className={`absolute inset-0 ${borderClasses[size]} ${colorClasses.ring} rounded-full`} />
      {/* Spinning ring */}
      <div className={`absolute inset-0 ${borderClasses[size]} border-transparent ${colorClasses.spin} rounded-full animate-spin`} />
      {/* Inner pulsing dot */}
      <div className={`absolute ${innerSizeClasses[size]} ${colorClasses.pulse} rounded-full animate-pulse`} />
    </div>
  );

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      {spinner}
      {text && (
        <p className={`${colorClasses.text} font-medium text-center`}>
          {text}
        </p>
      )}
      {subtext && (
        <p className="text-white/60 text-sm text-center">
          {subtext}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center h-dvh bg-dark">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * Overlay de chargement pour couvrir un conteneur.
 */
interface LoadingOverlayProps {
  /** Afficher l'overlay */
  show: boolean;
  /** Texte à afficher */
  text?: string;
}

export function LoadingOverlay({ show, text }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-dark/80 backdrop-blur-sm">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
