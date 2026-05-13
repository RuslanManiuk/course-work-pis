import apiClient from './client';
import type { Team, KanbanBoard, KanbanCard, Submission } from '@/types';

export const teamsApi = {
  create: (data: { name: string; description?: string; hackathon_id: string }) =>
    apiClient.post<Team>('/teams', data),

  get: (id: string) => apiClient.get<Team>(`/teams/${id}`),

  update: (id: string, data: Partial<{ name: string; description: string }>) =>
    apiClient.put<Team>(`/teams/${id}`, data),

  getMyTeams: () => apiClient.get<Team[]>('/users/me/teams'),

  getInvitePreview: (token: string) =>
    apiClient.get<{ team: Team; can_join: boolean; reason?: string }>(`/teams/invite/${token}`),

  acceptInvite: (token: string) => apiClient.post<Team>(`/teams/invite/${token}/accept`),

  joinByToken: (teamId: string, inviteToken: string) =>
    apiClient.post<Team>(`/teams/${teamId}/join`, { invite_token: inviteToken }),

  regenerateInvite: (teamId: string) =>
    apiClient.post<Team>(`/teams/${teamId}/regenerate-invite`),

  leave: (id: string) => apiClient.post(`/teams/${id}/leave`),

  removeMember: (teamId: string, userId: string) =>
    apiClient.delete(`/teams/${teamId}/members/${userId}`),

  getMatchmaking: (hackathonId: string) =>
    apiClient.get<Array<{ team_id: string; team_name: string; description: string; current_size: number; skill_gap: string[]; match_score: number }>>(
      '/matchmaking/suggestions',
      { params: { hackathon_id: hackathonId } },
    ),

  // Workspace
  getWorkspace: (teamId: string) =>
    apiClient.get<{ board: KanbanBoard }>(`/teams/${teamId}/workspace`),

  createCard: (teamId: string, data: Partial<KanbanCard>) =>
    apiClient.post<KanbanCard>(`/teams/${teamId}/kanban/cards`, data),

  updateCard: (teamId: string, cardId: string, data: Partial<KanbanCard>) =>
    apiClient.put<KanbanCard>(`/teams/${teamId}/kanban/cards/${cardId}`, data),

  deleteCard: (teamId: string, cardId: string) =>
    apiClient.delete(`/teams/${teamId}/kanban/cards/${cardId}`),

  reorderCards: (teamId: string, cards: Array<{ id: string; status: string; order: number }>) =>
    apiClient.patch(`/teams/${teamId}/kanban/cards/reorder`, { cards }),

  createSubmission: (
    teamId: string,
    data: { hackathon_id: string; repository_url: string; description: string; repo_is_private?: boolean; video_pitch_url?: string; presentation_url?: string },
  ) => apiClient.post<Submission>(`/teams/${teamId}/submissions`, data),

  getSubmission: (teamId: string) =>
    apiClient.get<Submission>(`/teams/${teamId}/submissions`),

  updateSubmission: (teamId: string, submissionId: string, data: Partial<Submission>) =>
    apiClient.put<Submission>(`/teams/${teamId}/submissions/${submissionId}`, data),

  verifyRepoAccess: (teamId: string, submissionId: string) =>
    apiClient.post<Submission>(`/teams/${teamId}/submissions/${submissionId}/verify-access`),

  getRepoStats: (teamId: string) =>
    apiClient.get<{
      full_name: string;
      description: string | null;
      stars: number;
      forks: number;
      open_issues: number;
      language: string | null;
      topics: string[];
      default_branch: string;
      commit_count: number;
      contributors_count: number;
      last_pushed_at: string | null;
      size_kb: number;
    }>(`/teams/${teamId}/submissions/repo-stats`),
};
