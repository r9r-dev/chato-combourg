import type { Player, SelectedPlayer } from '../types';

type PlayerLike = Player | SelectedPlayer;

interface PlayerBadgeProps {
  /** Joueur à afficher */
  player: PlayerLike;
  /** Taille du badge (défaut: 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Afficher l'initiale au lieu du contenu personnalisé */
  showInitial?: boolean;
  /** Contenu personnalisé (numéro, icône, etc.) */
  children?: React.ReactNode;
  /** Classes CSS additionnelles */
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

/**
 * Badge circulaire coloré pour identifier un joueur.
 *
 * Peut afficher :
 * - L'initiale du joueur (showInitial=true)
 * - Un contenu personnalisé (children)
 * - Rien (juste la couleur)
 */
export function PlayerBadge({
  player,
  size = 'md',
  showInitial = false,
  children,
  className = '',
}: PlayerBadgeProps) {
  const content = children ?? (showInitial ? player.name.charAt(0).toUpperCase() : null);

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: player.color }}
    >
      {content}
    </div>
  );
}
