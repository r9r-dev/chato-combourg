import { useState, useEffect } from 'react';

const LAST_SEEN_VERSION_KEY = 'chato_last_seen_version';

export function WhatsNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [changes, setChanges] = useState<string[]>([]);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const checkForUpdates = async () => {
      const currentVersion = __APP_VERSION__;
      const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);

      // Si c'est la premiere visite ou meme version, ne rien afficher
      if (!lastSeenVersion) {
        localStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
        return;
      }

      if (lastSeenVersion === currentVersion) {
        return;
      }

      // Nouvelle version detectee, charger le changelog
      try {
        const response = await fetch('/CHANGELOG.md');
        if (!response.ok) return;

        const text = await response.text();
        const latestChanges = parseLatestChanges(text);

        if (latestChanges.version && latestChanges.changes.length > 0) {
          setVersion(latestChanges.version);
          setChanges(latestChanges.changes);
          setIsOpen(true);
        }
      } catch {
        // Ignore errors
      }
    };

    checkForUpdates();
  }, []);

  const handleClose = () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, __APP_VERSION__);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
      <div className="relative w-full max-w-sm bg-dark-lighter rounded-2xl p-6 max-h-[80vh] overflow-hidden flex flex-col">
        <h2 className="text-gold text-xl font-bold mb-2">Notes de version</h2>
        <p className="text-white/60 text-sm mb-4">{version}</p>

        <div className="flex-1 overflow-auto mb-4">
          <ul className="space-y-2">
            {changes.map((change, index) => (
              <li key={index} className="text-white/80 text-sm flex">
                <span className="text-gold mr-2">-</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleClose}
          className="w-full p-3 bg-gold rounded-xl text-dark font-semibold"
        >
          Compris
        </button>
      </div>
    </div>
  );
}

// Parse le changelog pour extraire la derniere version et ses changements
function parseLatestChanges(markdown: string): { version: string; changes: string[] } {
  const lines = markdown.split('\n');
  let version = '';
  const changes: string[] = [];
  let inLatestVersion = false;

  for (const line of lines) {
    // Detecter une version (## v1.2.3)
    if (line.startsWith('## ')) {
      if (inLatestVersion) {
        // On a atteint la version suivante, arreter
        break;
      }
      version = line.slice(3).trim();
      inLatestVersion = true;
      continue;
    }

    // Collecter les changements de la derniere version
    if (inLatestVersion && line.startsWith('- ')) {
      changes.push(line.slice(2).trim());
    }
  }

  return { version, changes };
}
