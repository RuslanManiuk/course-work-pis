import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';

export function useAuth() {
  const { user, accessToken, setTokens, setUser, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await authApi.login(email, password);
      setTokens(data.access_token, data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      navigate('/dashboard');
    },
    [setTokens, setUser, navigate],
  );

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const { data } = await authApi.register(email, username, password);
      setTokens(data.access_token, data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      navigate('/dashboard');
    },
    [setTokens, setUser, navigate],
  );

  const signOut = useCallback(() => {
    logout();
    navigate('/auth/login');
  }, [logout, navigate]);

  return { user, accessToken, login, register, signOut, isAuthenticated };
}
