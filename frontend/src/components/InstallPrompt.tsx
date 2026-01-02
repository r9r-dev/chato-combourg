import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  // Check if already installed (running as standalone PWA)
  const [isInstalled, setIsInstalled] = useState(() => {
    return window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  });

  useEffect(() => {
    // Skip event listeners if already installed
    if (isInstalled) return;

    // Listen for the beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setInstallPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Store dismissal in sessionStorage so it doesn't show again this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if already installed, dismissed, or no prompt available
  if (isInstalled || !isVisible || sessionStorage.getItem('installPromptDismissed')) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-dark-lighter border border-gold/30 rounded-2xl p-4 shadow-lg shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold">Installer l'application</h3>
            <p className="text-white/60 text-sm mt-1">
              Ajoutez Châto Combourg sur votre écran d'accueil pour un accès rapide.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/40 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 px-4 bg-dark-card text-white/70 rounded-xl
                       hover:bg-dark hover:text-white transition-colors"
          >
            Plus tard
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 py-2.5 px-4 bg-gold text-dark font-semibold rounded-xl
                       hover:bg-gold-light transition-colors"
          >
            Installer
          </button>
        </div>
      </div>
    </div>
  );
}
