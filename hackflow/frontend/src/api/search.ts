import apiClient from './client';

export interface SearchHitHackathon {
  id: string;
  title: string;
  status: string;
  end_date: string;
  banner_url: string | null;
}

export interface SearchHitTeam {
  id: string;
  hackathon_id: string;
  name: string;
  hackathon_title: string | null;
  size: number;
}

export interface SearchHitUser {
  id: string;
  username: string;
  role: string;
  avatar_url: string | null;
}

export interface SearchResults {
  query: string;
  hackathons: SearchHitHackathon[];
  teams: SearchHitTeam[];
  users: SearchHitUser[];
}

export const searchApi = {
  query: (q: string, limit: number = 5) =>
    apiClient.get<SearchResults>('/search', { params: { q, limit } }),
};
