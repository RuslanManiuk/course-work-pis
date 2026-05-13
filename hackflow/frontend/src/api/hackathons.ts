import apiClient from './client';
import type { Hackathon, EvaluationCriteria } from '@/types';

export interface HackathonCreatePayload {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  submission_deadline: string;
  registration_deadline: string;
  max_team_size: number;
  min_team_size: number;
  max_participants?: number;
  discord_server_id?: string;
  banner_url?: string;
  tags?: { name: string }[];
}

export const hackathonsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<Hackathon[]>('/hackathons', { params }),

  get: (id: string) => apiClient.get<Hackathon>(`/hackathons/${id}`),

  create: (data: HackathonCreatePayload) => apiClient.post<Hackathon>('/hackathons', data),

  update: (id: string, data: Partial<HackathonCreatePayload>) =>
    apiClient.put<Hackathon>(`/hackathons/${id}`, data),

  getCriteria: (id: string) =>
    apiClient.get<EvaluationCriteria[]>(`/hackathons/${id}/criteria`),

  addCriteria: (id: string, criteria: Omit<EvaluationCriteria, 'id' | 'hackathon_id'>[]) =>
    apiClient.post<EvaluationCriteria[]>(`/hackathons/${id}/criteria`, { criteria }),

  generateCriteria: (id: string, n: number = 5) =>
    apiClient.post<{ suggestions: { name: string; description: string; weight: number; max_score: number }[] }>(
      `/hackathons/${id}/criteria/generate`,
      { n },
    ),

  aiDescribe: (title: string) =>
    apiClient.post<{ description: string }>('/hackathons/ai-describe', { title }),

  // ── Winners ──
  listWinners: (id: string) =>
    apiClient.get<HackathonWinner[]>(`/hackathons/${id}/winners`),

  upsertWinner: (
    id: string,
    data: { team_id: string; rank: number; prize?: string | null; note?: string | null },
  ) => apiClient.post<HackathonWinner>(`/hackathons/${id}/winners`, data),

  updateWinner: (
    id: string,
    winnerId: string,
    data: { rank?: number; prize?: string | null; note?: string | null },
  ) => apiClient.patch<HackathonWinner>(`/hackathons/${id}/winners/${winnerId}`, data),

  deleteWinner: (id: string, winnerId: string) =>
    apiClient.delete(`/hackathons/${id}/winners/${winnerId}`),

  autoWinners: (id: string, top: number = 3) =>
    apiClient.post<HackathonWinner[]>(`/hackathons/${id}/winners/auto`, null, {
      params: { top },
    }),
};

export interface HackathonWinner {
  id: string;
  hackathon_id: string;
  team_id: string;
  team_name: string;
  rank: number;
  prize: string | null;
  note: string | null;
  avg_score: number | null;
  created_at: string;
}
