/**
 * PlayMenu - Menu hamburger du mode Play
 *
 * Menu latéral slide-in avec les options :
 * - Rechercher une carte
 * - Voir la défausse
 * - Répartition des blasons
 * - Aide de jeu
 * - Règles du jeu
 * - Recommencer la partie
 * - Quitter la partie
 */

import { useEffect, useRef } from 'react';
import {
  SearchIcon,
  DiscardIcon,
  ShieldDistIcon,
  HelpIcon,
  RulesIcon,
  RestartIcon,
  QuitIcon,
} from './Icons';

export type PlayMenuAction =
  | 'search'
  | 'discard'
  | 'shields'
  | 'help'
  | 'rules'
  | 'restart'
  | 'quit';

interface PlayMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: PlayMenuAction) => void;
}

interface MenuItem {
  action: PlayMenuAction;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    action: 'search',
    label: 'Rechercher une carte',
    icon: <SearchIcon className="w-5 h-5" />,
  },
  {
    action: 'discard',
    label: 'Voir la défausse',
    icon: <DiscardIcon className="w-5 h-5" />,
  },
  {
    action: 'shields',
    label: 'Répartition des blasons',
    icon: <ShieldDistIcon className="w-5 h-5" />,
  },
  {
    action: 'help',
    label: 'Aide de jeu',
    icon: <HelpIcon className="w-5 h-5" />,
  },
  {
    action: 'rules',
    label: 'Règles du jeu',
    icon: <RulesIcon className="w-5 h-5" />,
  },
  {
    action: 'restart',
    label: 'Recommencer la partie',
    icon: <RestartIcon className="w-5 h-5" />,
    danger: true,
  },
  {
    action: 'quit',
    label: 'Quitter la partie',
    icon: <QuitIcon className="w-5 h-5" />,
    danger: true,
  },
];

export function PlayMenu({ isOpen, onClose, onAction }: PlayMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap dans le menu
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstButton = menuRef.current.querySelector('button');
      firstButton?.focus();
    }
  }, [isOpen]);

  const handleAction = (action: PlayMenuAction) => {
    onClose();
    onAction(action);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu panel */}
      <div
        ref={menuRef}
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-dark-lighter z-50
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu du jeu"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Menu</h2>
        </div>

        {/* Menu items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          <ul className="space-y-1">
            {MENU_ITEMS.map((item, index) => (
              <li key={item.action}>
                {/* Séparateur avant "Quitter" */}
                {item.danger && index > 0 && (
                  <div className="my-2 mx-4 border-t border-white/10" />
                )}
                <button
                  onClick={() => handleAction(item.action)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left
                    transition-colors duration-150
                    ${
                      item.danger
                        ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <span className={item.danger ? 'text-red-400' : 'text-gold'}>
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer hint */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            Appuyez sur Échap pour fermer
          </p>
        </div>
      </div>
    </>
  );
}
