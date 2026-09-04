'use client';

import { createContext, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { AuthenticatedUser } from './types';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await api.get<{ user: AuthenticatedUser }>('/auth/me');
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const value = useMemo<AuthContextValue>(
    () => ({ user: query.data ?? null, isLoading: query.isLoading, refetch: query.refetch }),
    [query.data, query.isLoading, query.refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    await api.post('/auth/logout');
    queryClient.setQueryData(['auth', 'me'], null);
    window.location.href = '/login';
  };
}
