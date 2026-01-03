/**
 * AnimatedResource - Affichage de ressource avec animation de variation
 *
 * Affiche un texte flottant (+X ou -X) qui monte et s'estompe
 * quand la valeur change.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';

interface ResourceChange {
  id: number;
  delta: number;
}

interface AnimatedResourceProps {
  value: number;
  icon: ReactNode;
  className?: string;
}

export function AnimatedResource({ value, icon, className = '' }: AnimatedResourceProps) {
  const [changes, setChanges] = useState<ResourceChange[]>([]);
  const prevValueRef = useRef<number>(value);
  const idCounterRef = useRef(0);

  useEffect(() => {
    const prevValue = prevValueRef.current;
    const delta = value - prevValue;

    if (delta !== 0) {
      const newChange: ResourceChange = {
        id: idCounterRef.current++,
        delta,
      };

      setChanges((prev) => [...prev, newChange]);

      // Supprimer l'animation apres 1.5 secondes
      setTimeout(() => {
        setChanges((prev) => prev.filter((c) => c.id !== newChange.id));
      }, 1500);
    }

    prevValueRef.current = value;
  }, [value]);

  return (
    <span className={`relative flex items-center gap-1 font-medium ${className}`}>
      {icon}
      <span className="tabular-nums">{value}</span>

      {/* Animations des changements */}
      {changes.map((change) => (
        <span
          key={change.id}
          className={`absolute left-1/2 -top-2 pointer-events-none font-bold text-sm px-1.5 py-0.5 rounded-full animate-resource-change ${
            change.delta > 0
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50'
              : 'bg-red-500 text-white shadow-lg shadow-red-500/50'
          }`}
        >
          {change.delta > 0 ? `+${change.delta}` : change.delta}
        </span>
      ))}
    </span>
  );
}
