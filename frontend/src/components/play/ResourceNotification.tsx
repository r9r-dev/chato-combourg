/**
 * ResourceNotification - Notifications de changement de ressources
 *
 * Affiche une notification visible en bas de l'écran quand les ressources changent.
 * Ne s'affiche pas au changement de joueur.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';

interface Notification {
  id: number;
  type: 'gold' | 'keys';
  delta: number;
  icon: ReactNode;
}

interface ResourceNotificationProps {
  gold: number;
  keys: number;
  playerId: string;
  goldIcon: ReactNode;
  keysIcon: ReactNode;
}

export function ResourceNotification({
  gold,
  keys,
  playerId,
  goldIcon,
  keysIcon,
}: ResourceNotificationProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevValuesRef = useRef<{ gold: number; keys: number; playerId: string }>({
    gold,
    keys,
    playerId,
  });
  const idCounterRef = useRef(0);

  useEffect(() => {
    const prev = prevValuesRef.current;

    // Si le joueur change, on ne montre pas d'animation
    if (prev.playerId !== playerId) {
      prevValuesRef.current = { gold, keys, playerId };
      return;
    }

    const newNotifications: Notification[] = [];

    // Changement d'or
    const goldDelta = gold - prev.gold;
    if (goldDelta !== 0) {
      newNotifications.push({
        id: idCounterRef.current++,
        type: 'gold',
        delta: goldDelta,
        icon: goldIcon,
      });
    }

    // Changement de clés
    const keysDelta = keys - prev.keys;
    if (keysDelta !== 0) {
      newNotifications.push({
        id: idCounterRef.current++,
        type: 'keys',
        delta: keysDelta,
        icon: keysIcon,
      });
    }

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...prev, ...newNotifications]);

      // Supprimer les notifications après l'animation (2s)
      const ids = newNotifications.map((n) => n.id);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      }, 2000);
    }

    prevValuesRef.current = { gold, keys, playerId };
  }, [gold, keys, playerId, goldIcon, keysIcon]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 pointer-events-none flex flex-col items-center gap-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl animate-notification ${
            notification.delta > 0
              ? 'bg-emerald-600/95 text-white shadow-emerald-500/40'
              : 'bg-red-600/95 text-white shadow-red-500/40'
          }`}
        >
          <span className="w-7 h-7">{notification.icon}</span>
          <span className="text-2xl font-bold tabular-nums">
            {notification.delta > 0 ? `+${notification.delta}` : notification.delta}
          </span>
        </div>
      ))}
    </div>
  );
}
