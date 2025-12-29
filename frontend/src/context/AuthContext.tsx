import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Player } from '../types';
import { getCurrentUser, getPlayers, createPlayer, deletePlayer } from '../services/api';

interface AuthContextType {
  user: User | null;
  players: Player[];
  loading: boolean;
  error: string | null;
  refreshPlayers: () => Promise<void>;
  addPlayer: (name: string) => Promise<Player>;
  removePlayer: (playerId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user and players on mount
  useEffect(() => {
    async function load() {
      try {
        const [userData, playersData] = await Promise.all([
          getCurrentUser(),
          getPlayers(),
        ]);
        setUser(userData);
        setPlayers(playersData);
        setError(null);
      } catch (err) {
        console.error('Failed to load user data:', err);
        setError('Impossible de charger les donnees utilisateur');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const refreshPlayers = useCallback(async () => {
    try {
      const playersData = await getPlayers();
      setPlayers(playersData);
    } catch (err) {
      console.error('Failed to refresh players:', err);
    }
  }, []);

  const addPlayer = useCallback(async (name: string): Promise<Player> => {
    const player = await createPlayer(name);
    setPlayers((prev) => [...prev, player]);
    return player;
  }, []);

  const removePlayer = useCallback(async (playerId: number): Promise<void> => {
    await deletePlayer(playerId);
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        players,
        loading,
        error,
        refreshPlayers,
        addPlayer,
        removePlayer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
