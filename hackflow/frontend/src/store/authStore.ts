import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setTokens(access, refresh) {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        set({ accessToken: access, refreshToken: refresh });
      },

      setUser(user) {
        set({ user });
      },

      logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null, refreshToken: null });
      },

      isAuthenticated() {
        return !!get().accessToken;
      },
    }),
    {
      name: 'hackflow-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
