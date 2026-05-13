// ── Enums ─────────────────────────────────────────────────────────────────────

export type UserRole = 'hacker' | 'mentor' | 'judge' | 'organizer';
export type HackathonStatus = 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled';
export type TeamStatus = 'forming' | 'active' | 'submitted' | 'eliminated' | 'won';
export type TeamMemberRole = 'leader' | 'member';
export type SubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'scored';
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';
export type CardStatus = 'todo' | 'in_progress' | 'done';
export type NotificationType =
  | 'team_invite'
  | 'mentor_assigned'
  | 'score_update'
  | 'event_reminder'
  | 'submission_accepted'
  | 'broadcast';

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface SkillItem {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface TechItem {
  tech: string;
  years: number;
}

export interface UserProfile {
  bio?: string;
  skills: SkillItem[];
  tech_stack: TechItem[];
  years_experience?: number;
  mentoring_expertise?: string[];
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  github_id?: string;
  github_username?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  profile?: UserProfile;
}

export interface GithubStats {
  repositories: number;
  followers: number;
  total_contributions: number;
  language_breakdown: Record<string, number>;
  cached_at: string;
}

// ── Hackathon ─────────────────────────────────────────────────────────────────

export interface EvaluationCriteria {
  id: string;
  hackathon_id: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
  order: number;
}

export interface Hackathon {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  status: HackathonStatus;
  start_date: string;
  end_date: string;
  submission_deadline: string;
  registration_deadline: string;
  max_team_size: number;
  min_team_size: number;
  max_participants?: number;
  banner_url?: string;
  tags: { name: string }[];
  criteria?: EvaluationCriteria[];
}

// ── Team ──────────────────────────────────────────────────────────────────────

export interface TeamMember {
  user_id: string;
  team_id: string;
  role: TeamMemberRole;
  joined_at: string;
  user?: User;
}

/** Flat member shape returned by TeamResponse from the API */
export interface TeamMemberInfo {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  role: TeamMemberRole;
  joined_at: string;
}

export interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  description?: string;
  status: TeamStatus;
  leader_id: string;
  size: number;
  invite_token?: string;
  invite_token_expires_at?: string;
  discord_text_channel_id?: string;
  discord_voice_channel_id?: string;
  discord_guild_id?: string;
  avg_score?: number;
  created_at: string;
  members: TeamMemberInfo[];
}

// ── Submission ────────────────────────────────────────────────────────────────

export interface Submission {
  id: string;
  team_id: string;
  hackathon_id: string;
  repository_url: string;
  video_pitch_url?: string;
  presentation_url?: string;
  description: string;
  status: SubmissionStatus;
  embedding_indexed: boolean;
  repo_is_private: boolean;
  repo_access_status: 'accessible' | 'pending' | 'access_lost';
  submitted_at?: string;
}

// ── Kanban ────────────────────────────────────────────────────────────────────

export type CardLabel =
  | 'feature'
  | 'bug'
  | 'design'
  | 'docs'
  | 'ops'
  | 'research';

export interface KanbanCard {
  id: string;
  team_id: string;
  created_by_id: string;
  assigned_to_id?: string;
  title: string;
  description?: string;
  status: CardStatus;
  priority: number;
  label?: CardLabel | string | null;
  order: number;
  due_date?: string;
}

export interface KanbanBoard {
  todo: KanbanCard[];
  in_progress: KanbanCard[];
  done: KanbanCard[];
}

// ── Helpdesk ──────────────────────────────────────────────────────────────────

export interface HelpDeskTicket {
  id: string;
  team_id: string;
  hackathon_id: string;
  created_by_id: string;
  assigned_mentor_id?: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  jitsi_room_url?: string;
  session_start?: string;
  session_end?: string;
  resolution_notes?: string;
  created_at: string;
}

// ── Evaluation ────────────────────────────────────────────────────────────────

export interface Evaluation {
  id: string;
  submission_id: string;
  judge_id: string;
  criteria_id: string;
  score: number;
  feedback?: string;
  created_at: string;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  avg_score?: number;
  submission_id?: string;
}

export interface LeaderboardResponse {
  hackathon_id: string;
  entries: LeaderboardEntry[];
  total: number;
}

// ── Notification ──────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  hackathon_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

// ── WebSocket events ──────────────────────────────────────────────────────────

export interface WsEvent {
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ── API pagination ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
