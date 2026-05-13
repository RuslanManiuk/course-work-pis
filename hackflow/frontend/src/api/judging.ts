import apiClient from './client';
import type { Evaluation, LeaderboardResponse } from '@/types';

export const judgingApi = {
  getSubmissionsForJudging: (hackathonId: string) =>
    apiClient.get<
      Array<{
        submission_id: string;
        team_id: string;
        team_name?: string;
        status: string;
        scored_by_me: boolean;
        repository_url?: string;
        video_pitch_url?: string;
        presentation_url?: string;
        description?: string;
        submitted_at?: string;
      }>
    >(`/hackathons/${hackathonId}/submissions`),

  evaluate: (
    submissionId: string,
    evaluations: Array<{ criteria_id: string; score: number; feedback?: string }>,
  ) => apiClient.post<Evaluation[]>(`/submissions/${submissionId}/evaluate`, { evaluations }),

  getLeaderboard: (hackathonId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get<LeaderboardResponse>(`/hackathons/${hackathonId}/leaderboard`, { params }),

  aiSummary: (submissionId: string) =>
    apiClient.post<{ summary: string }>(`/submissions/${submissionId}/ai-summary`),

  aiEvaluate: (submissionId: string) =>
    apiClient.post<{
      scores: { criteria_id: string; criteria_name: string; score: number; feedback: string }[];
    }>(`/submissions/${submissionId}/ai-evaluate`),
};
