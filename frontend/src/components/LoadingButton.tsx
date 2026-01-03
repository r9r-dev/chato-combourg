import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Bouton avec état de chargement intégré.
 * Affiche un spinner et désactive le bouton pendant le chargement.
 */

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** État de chargement */
  loading?: boolean;
  /** Texte affiché pendant le chargement (optionnel, sinon spinner seul) */
  loadingText?: string;
  /** Variante de style */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Contenu du bouton */
  children: ReactNode;
}

export function LoadingButton({
  loading = false,
  loadingText,
  variant = 'secondary',
  children,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  const baseClasses = 'relative flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-gold text-dark hover:bg-gold-light active:bg-gold-dark',
    secondary: 'bg-dark-lighter text-white/70 hover:bg-dark-card hover:text-white',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
  };

  const spinnerColor = variant === 'primary' ? 'border-dark/30 border-t-dark' : 'border-white/30 border-t-white';

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading && (
        <div className={`w-4 h-4 border-2 ${spinnerColor} rounded-full animate-spin`} />
      )}
      <span className={loading && !loadingText ? 'invisible' : ''}>
        {loading && loadingText ? loadingText : children}
      </span>
    </button>
  );
}
