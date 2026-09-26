import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { Role, User } from '@/types/api';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, portal: Role) => Promise<User>;
  register: (input: { name: string; email: string; password: string; regionId: string }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    api
      .get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch((err) => {
        if (!(err instanceof ApiError) || err.status !== 401) console.warn(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, portal: Role) => {
    const r = await api.post<{ user: User }>('/auth/login', { email, password, portal });
    queryClient.clear();
    setUser(r.user);
    return r.user;
  }, [queryClient]);

  const register = useCallback(async (input: { name: string; email: string; password: string; regionId: string }) => {
    const r = await api.post<{ user: User }>('/auth/register', input);
    queryClient.clear();
    setUser(r.user);
    return r.user;
  }, [queryClient]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
