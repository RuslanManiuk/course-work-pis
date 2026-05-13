import apiClient from './client';
import type { User } from '@/types';

export interface UpdateProfilePayload {
  bio?: string;
  skills?: { name: string; proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert' }[];
  tech_stack?: { tech: string; years: number }[];
  years_experience?: number;
  mentoring_expertise?: string[];
}

export const usersApi = {
  getMe: () => apiClient.get<User>('/users/me'),
  updateProfile: (data: UpdateProfilePayload) =>
    apiClient.put<User>('/users/me/profile', data),
};
