import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Changelog() {
  const { setStep } = useGame();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChangelog = async () => {
      try {
        const response = await fetch('/CHANGELOG.md');
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        } else {
          setContent('Impossible de charger les notes de version.');
        }
      } catch {
        setContent('Impossible de charger les notes de version.');
      } finally {
        setLoading(false);
      }
    };
    loadChangelog();
  }, []);

  // Simple markdown parser for changelog
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;

    for (const line of lines) {
      // H1: # Title
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={key++} className="text-gold text-2xl font-bold mb-4">
            {line.slice(2)}
          </h1>
        );
      }
      // H2: ## Version
      else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={key++} className="text-white text-lg font-semibold mt-6 mb-2 border-b border-white/10 pb-2">
            {line.slice(3)}
          </h2>
        );
      }
      // H3: ### Section
      else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={key++} className="text-white/80 text-base font-medium mt-4 mb-2">
            {line.slice(4)}
          </h3>
        );
      }
      // List item: - Item
      else if (line.startsWith('- ')) {
        elements.push(
          <li key={key++} className="text-white/60 text-sm ml-4 mb-1">
            {line.slice(2)}
          </li>
        );
      }
      // Empty line
      else if (line.trim() === '') {
        // Skip
      }
      // Regular text
      else if (line.trim()) {
        elements.push(
          <p key={key++} className="text-white/60 text-sm mb-2">
            {line}
          </p>
        );
      }
    }

    return elements;
  };

  return (
    <div className="flex flex-col h-dvh bg-dark">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={() => setStep('settings')} className="text-white/60 hover:text-white">
          Retour
        </button>
        <h1 className="text-lg font-semibold text-white">Notes de version</h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" text="Chargement..." />
          </div>
        ) : (
          <div className="prose prose-invert max-w-none">
            {renderMarkdown(content)}
          </div>
        )}
      </div>
    </div>
  );
}
