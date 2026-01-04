import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { User, Player, PlayerWithStats, PlayerOrderMode } from '../types';
import {
  getCurrentUser,
  getPlayersWithStats,
  createPlayer,
  deletePlayer,
  getSettings,
  updateSettings,
} from '../services/api';

interface AuthContextType {
  user: User | null;
  players: Player[];
  playersWithStats: PlayerWithStats[];
  sortedPlayers: PlayerWithStats[];
  playerOrder: PlayerOrderMode;
  manualPlayerOrder: number[];
  loading: boolean;
  error: string | null;
  refreshPlayers: () => Promise<void>;
  addPlayer: (name: string) => Promise<Player>;
  removePlayer: (playerId: number) => Promise<void>;
  setPlayerOrder: (order: PlayerOrderMode, manualOrder?: number[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersWithStats, setPlayersWithStats] = useState<PlayerWithStats[]>([]);
  const [playerOrder, setPlayerOrderState] = useState<PlayerOrderMode>('alphabetical');
  const [manualPlayerOrder, setManualPlayerOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user, players with stats, and settings on mount
  useEffect(() => {
    async function load() {
      try {
        const [userData, playersData, settingsData] = await Promise.all([
          getCurrentUser(),
          getPlayersWithStats(),
          getSettings(),
        ]);
        setUser(userData);
        setPlayers(playersData);
        setPlayersWithStats(playersData);

        // Parse settings
        if (settingsData.player_order) {
          setPlayerOrderState(settingsData.player_order as PlayerOrderMode);
        }
        if (settingsData.manual_player_order) {
          try {
            setManualPlayerOrder(JSON.parse(settingsData.manual_player_order));
          } catch {
            // Invalid JSON, ignore
          }
        }

        setError(null);
      } catch (err) {
        console.error('Failed to load user data:', err);
        setError('Impossible de charger les données utilisateur');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute sorted players based on order preference (excluding AI players)
  const sortedPlayers = useMemo(() => {
    // Filter out AI players - they should not appear in player selection
    const humanPlayers = playersWithStats.filter(p => !p.is_ai);
    const playersCopy = [...humanPlayers];

    switch (playerOrder) {
      case 'alphabetical':
        return playersCopy.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

      case 'manual':
        if (manualPlayerOrder.length > 0) {
          return playersCopy.sort((a, b) => {
            const indexA = manualPlayerOrder.indexOf(a.id);
            const indexB = manualPlayerOrder.indexOf(b.id);
            // Players not in manual order go to the end
            if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name, 'fr');
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
        }
        return playersCopy;

      case 'most_played':
        return playersCopy.sort((a, b) => b.games_count - a.games_count);

      case 'last_played':
        return playersCopy.sort((a, b) => {
          if (!a.last_played_at && !b.last_played_at) return a.name.localeCompare(b.name, 'fr');
          if (!a.last_played_at) return 1;
          if (!b.last_played_at) return -1;
          return new Date(b.last_played_at).getTime() - new Date(a.last_played_at).getTime();
        });

      default:
        return playersCopy;
    }
  }, [playersWithStats, playerOrder, manualPlayerOrder]);

  const refreshPlayers = useCallback(async () => {
    try {
      const playersData = await getPlayersWithStats();
      setPlayers(playersData);
      setPlayersWithStats(playersData);
    } catch (err) {
      console.error('Failed to refresh players:', err);
    }
  }, []);

  const addPlayer = useCallback(async (name: string): Promise<Player> => {
    const player = await createPlayer(name);
    const playerWithStats: PlayerWithStats = {
      ...player,
      games_count: 0,
      last_played_at: null,
    };
    setPlayers((prev) => [...prev, player]);
    setPlayersWithStats((prev) => [...prev, playerWithStats]);
    return player;
  }, []);

  const removePlayer = useCallback(async (playerId: number): Promise<void> => {
    await deletePlayer(playerId);
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setPlayersWithStats((prev) => prev.filter((p) => p.id !== playerId));
  }, []);

  const setPlayerOrder = useCallback(async (order: PlayerOrderMode, manualOrder?: number[]) => {
    setPlayerOrderState(order);
    if (manualOrder !== undefined) {
      setManualPlayerOrder(manualOrder);
    }

    // Persist to backend
    try {
      const settingsToUpdate: Record<string, string | null> = {
        player_order: order,
      };
      if (manualOrder !== undefined) {
        settingsToUpdate.manual_player_order = JSON.stringify(manualOrder);
      }
      await updateSettings(settingsToUpdate);
    } catch (err) {
      console.error('Failed to save player order settings:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        players,
        playersWithStats,
        sortedPlayers,
        playerOrder,
        manualPlayerOrder,
        loading,
        error,
        refreshPlayers,
        addPlayer,
        removePlayer,
        setPlayerOrder,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
