import apiClient from './client';
import type { HelpDeskTicket } from '@/types';

export const helpdeskApi = {
  create: (data: {
    team_id: string;
    hackathon_id: string;
    title: string;
    description: string;
    priority: string;
    category: string;
  }) => apiClient.post<HelpDeskTicket>('/helpdesk/tickets', data),

  list: (params?: { hackathon_id?: string; team_id?: string; status?: string }) =>
    apiClient.get<HelpDeskTicket[]>('/helpdesk/tickets', { params }),

  get: (id: string) => apiClient.get<HelpDeskTicket>(`/helpdesk/tickets/${id}`),

  update: (id: string, data: Partial<HelpDeskTicket>) =>
    apiClient.put<HelpDeskTicket>(`/helpdesk/tickets/${id}`, data),

  assign: (id: string) => apiClient.post<HelpDeskTicket>(`/helpdesk/tickets/${id}/assign`),

  startSession: (id: string) => apiClient.post<HelpDeskTicket>(`/helpdesk/tickets/${id}/start-session`),

  endSession: (id: string, resolution_notes?: string) =>
    apiClient.post<HelpDeskTicket>(`/helpdesk/tickets/${id}/end-session`, { resolution_notes }),

  mentorQueue: (hackathon_id?: string) =>
    apiClient.get<HelpDeskTicket[]>('/helpdesk/mentor/queue', { params: { hackathon_id } }),

  myMentorTickets: () =>
    apiClient.get<HelpDeskTicket[]>('/helpdesk/mentor/my-tickets'),

  aiSuggestNotes: (id: string) =>
    apiClient.post<{ notes: string }>(`/helpdesk/tickets/${id}/ai-suggest-notes`),
};
