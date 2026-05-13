import apiClient from './client';
import type { TokenResponse, User } from '@/types';

export const authApi = {
  register: (email: string, username: string, password: string) =>
    apiClient.post<TokenResponse>('/auth/register', { email, username, password }),

  login: (email: string, password: string) =>
    apiClient.post<TokenResponse>('/auth/login', { email, password }),

  refresh: (refreshToken: string) =>
    apiClient.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken }),

  me: () => apiClient.get<User>('/auth/me'),

  githubRedirect: () => apiClient.get<{ redirect_url: string }>('/auth/github'),

  githubCallback: (code: string) => apiClient.get<TokenResponse>(`/auth/github/callback?code=${code}`),
};
