import apiClient from './client';
import type { User, UserRole } from '@/types';

export interface BroadcastPayload {
  hackathon_id: string | null;
  title: string;
  message: string;
}

export const adminApi = {
  listUsers: (params?: { role?: UserRole; page?: number; limit?: number }) =>
    apiClient.get<User[]>('/admin/users', { params }),

  updateUser: (userId: string, data: { role?: UserRole; is_active?: boolean }) =>
    apiClient.put<{ id: string; role: UserRole; is_active: boolean }>(
      `/admin/users/${userId}`,
      null,
      { params: data },
    ),

  broadcast: (data: BroadcastPayload) =>
    apiClient.post('/admin/notifications/broadcast', data),
};
