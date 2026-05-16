import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { helpdeskApi } from '@/api/helpdesk';
import { teamsApi } from '@/api/teams';
import { hackathonsApi } from '@/api/hackathons';
import { useAuthStore } from '@/store/authStore';
import type { HelpDeskTicket, TicketStatus } from '@/types';
import PageHero, { HeroAccent } from '@/components/ui/PageHero';
import styles from './HelpdeskPage.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<TicketStatus, string> = {
  open: '#3ecfcf',
  assigned: '#60a5fa',
  in_progress: '#fbbf24',
  resolved: '#4ade80',
  closed: '#5a5f7a',
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Mentor Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_COLOR: Record<string, string> = {
  low: '#4ade80',
  medium: '#fbbf24',
  high: '#f87171',
};

const CATEGORY_LABEL: Record<string, string> = {
  technical: 'Backend / Technical',
  frontend: 'Frontend / Design',
  pitch: 'Pitch / Presentation',
  general: 'General',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function HelpdeskPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [endingTicketId, setEndingTicketId] = useState<string | null>(null);

  const isMentor = user?.role === 'mentor';

  // User: their own tickets
  const { data: myTickets, isLoading: loadingMy } = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => helpdeskApi.list().then((r) => r.data),
    enabled: !isMentor,
  });

  // Mentor: open queue
  const { data: queue, isLoading: loadingQueue } = useQuery({
    queryKey: ['tickets', 'queue'],
    queryFn: () => helpdeskApi.mentorQueue().then((r) => r.data),
    enabled: isMentor,
    refetchInterval: 15000,
  });

  // Mentor: their accepted/active sessions
  const { data: activeSessions, isLoading: loadingActive } = useQuery({
    queryKey: ['tickets', 'active-sessions'],
    queryFn: () => helpdeskApi.myMentorTickets().then((r) => r.data),
    enabled: isMentor,
    refetchInterval: 10000,
  });

  // Mentor: hackathon lookup for context
  const { data: hackathons } = useQuery({
    queryKey: ['hackathons'],
    queryFn: () => hackathonsApi.list().then((r) => r.data),
    enabled: isMentor,
  });
  const hackathonMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    hackathons?.forEach((h) => { map[h.id] = h.title; });
    return map;
  }, [hackathons]);

  const assign = useMutation({
    mutationFn: (id: string) => helpdeskApi.assign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const startSession = useMutation({
    mutationFn: (id: string) => helpdeskApi.startSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });

  const endSession = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      helpdeskApi.endSession(id, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setEndingTicketId(null);
    },
  });

  const invalidateAll = () => qc.invalidateQueries({ queryKey: ['tickets'] });

  // ── Mentor view ────────────────────────────────────────────────────────────
  if (isMentor) {
    const queueCount = queue?.length ?? 0;
    const sessionCount = activeSessions?.length ?? 0;
    return (
      <div className={styles.root}>
        <PageHero
          eyebrow={queueCount > 0 ? `[${queueCount}] request${queueCount === 1 ? '' : 's'} in queue` : '$ mentor --console'}
          title={<>$ assign <HeroAccent>--mentor</HeroAccent> --help</>}
          subtitle="// pick up open requests · run jitsi sessions · close with resolution notes"
          actions={
            <span className={styles.roleTag}>[mentor] · {sessionCount} active</span>
          }
        />

        {/* Active sessions */}
        <section>
          <h2 className={styles.sectionTitle}>
            // active_sessions
            {activeSessions && activeSessions.length > 0 && (
              <span className={styles.countBadge}>{activeSessions.length}</span>
            )}
          </h2>

          {loadingActive && <p className={styles.loading}>Loading…</p>}

          {!loadingActive && (!activeSessions || activeSessions.length === 0) && (
            <p className={styles.empty}>// no active sessions · accept a ticket from the queue below</p>
          )}

          <div className={styles.list}>
            {activeSessions?.map((t) => (
              <MentorSessionCard
                key={t.id}
                ticket={t}
                isEndingThis={endingTicketId === t.id}
                onStartSession={() => startSession.mutate(t.id)}
                onOpenEndForm={() => setEndingTicketId(t.id)}
                onCancelEnd={() => setEndingTicketId(null)}
                onEndSession={(notes) => endSession.mutate({ id: t.id, notes })}
                isPending={startSession.isPending || endSession.isPending}
              />
            ))}
          </div>
        </section>

        {/* Open queue */}
        <section>
          <h2 className={styles.sectionTitle}>
            // open_queue
            {queue && queue.length > 0 && (
              <span className={styles.countBadge} style={{ background: 'rgba(248,113,113,.2)', color: '#f87171' }}>
                {queue.length}
              </span>
            )}
          </h2>

          {loadingQueue && <p className={styles.loading}>Loading queue…</p>}
          {!loadingQueue && !queue?.length && (
            <p className={styles.empty}>// queue empty · no open requests right now</p>
          )}

          <div className={styles.list}>
            {queue?.map((t) => (
              <QueueTicketCard
                key={t.id}
                ticket={t}
                hackathonTitle={hackathonMap[t.hackathon_id]}
                onAccept={() => assign.mutate(t.id)}
                isAccepting={assign.isPending}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ── User view ──────────────────────────────────────────────────────────────
  const activeTickets = myTickets?.filter((t) => !['resolved', 'closed'].includes(t.status)) ?? [];
  const doneTickets = myTickets?.filter((t) => ['resolved', 'closed'].includes(t.status)) ?? [];

  const openCount = activeTickets.length;

  return (
    <div className={styles.root}>
      <PageHero
        eyebrow={openCount > 0 ? `[${openCount}] active request${openCount === 1 ? '' : 's'}` : '$ helpdesk --request'}
        title={<>$ get-unblocked <HeroAccent>--fast</HeroAccent></>}
        subtitle="// drop a request · mentor joins jitsi · backend, frontend, pitch — anything"
        actions={
          <button className={styles.addBtn} onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'abort' : '$ new --ticket'}
          </button>
        }
      />

      {showForm && (
        <TicketForm
          onClose={() => setShowForm(false)}
          onCreated={() => { invalidateAll(); setShowForm(false); }}
        />
      )}

      {loadingMy && <p className={styles.loading}>Loading tickets…</p>}

      {activeTickets.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>// active_requests</h2>
          <div className={styles.list}>
            {activeTickets.map((t) => (
              <UserTicketCard key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      )}

      {doneTickets.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle} style={{ color: 'var(--text-muted)' }}>// resolved</h2>
          <div className={styles.list}>
            {doneTickets.map((t) => (
              <UserTicketCard key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      )}

      {!loadingMy && !myTickets?.length && (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateIcon}>[ ]</p>
          <p className={styles.emptyStateText}>// no help requests yet</p>
          <p className={styles.emptyStateHint}>run $ new --ticket to request mentor help</p>
        </div>
      )}
    </div>
  );
}

// ── Queue Ticket Card (mentor view — open tickets) ────────────────────────────

function QueueTicketCard({
  ticket: t,
  hackathonTitle,
  onAccept,
  isAccepting,
}: {
  ticket: HelpDeskTicket;
  hackathonTitle?: string;
  onAccept: () => void;
  isAccepting: boolean;
}) {
  return (
    <div className={styles.ticket}>
      <div className={styles.ticketTop}>
        <span className={styles.statusDot} style={{ background: STATUS_COLOR[t.status] }} />
        <span className={styles.ticketTitle}>{t.title}</span>
        <span className={styles.priority} style={{ color: PRIORITY_COLOR[t.priority] }}>
          {t.priority}
        </span>
        <span className={styles.timeAgo}>{timeAgo(t.created_at)}</span>
      </div>

      <p className={styles.desc}>{t.description}</p>

      <div className={styles.metaRow}>
        <span className={styles.metaTag}>[{CATEGORY_LABEL[t.category] ?? t.category}]</span>
        {hackathonTitle && (
          <span className={styles.metaTag}>[{hackathonTitle}]</span>
        )}
      </div>

      <div className={styles.ticketActions}>
        <button
          className={styles.acceptBtn}
          onClick={onAccept}
          disabled={isAccepting}
        >
          {isAccepting ? '$ accepting...' : '$ accept --ticket'}
        </button>
        <span className={`${styles.statusBadge}`} style={{ background: `${STATUS_COLOR[t.status]}22`, color: STATUS_COLOR[t.status] }}>
          {STATUS_LABEL[t.status]}
        </span>
      </div>
    </div>
  );
}

// ── Mentor Session Card (assigned / in_progress) ──────────────────────────────

function MentorSessionCard({
  ticket: t,
  isEndingThis,
  onStartSession,
  onOpenEndForm,
  onCancelEnd,
  onEndSession,
  isPending,
}: {
  ticket: HelpDeskTicket;
  isEndingThis: boolean;
  onStartSession: () => void;
  onOpenEndForm: () => void;
  onCancelEnd: () => void;
  onEndSession: (notes: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const isActive = t.status === 'in_progress';

  async function handleAiSuggestNotes() {
    setAiNotesLoading(true);
    try {
      const res = await helpdeskApi.aiSuggestNotes(t.id);
      setNotes(res.data.notes);
    } catch {
      // silently fail — user can still type manually
    } finally {
      setAiNotesLoading(false);
    }
  }

  return (
    <div className={`${styles.ticket} ${isActive ? styles.ticketActive : styles.ticketAssigned}`}>
      <div className={styles.ticketTop}>
        <span className={styles.statusDot} style={{ background: STATUS_COLOR[t.status] }} />
        <span className={styles.ticketTitle}>{t.title}</span>
        <span className={styles.priority} style={{ color: PRIORITY_COLOR[t.priority] }}>
          {t.priority}
        </span>
        <span className={styles.timeAgo}>{timeAgo(t.created_at)}</span>
      </div>

      <p className={styles.desc}>{t.description}</p>
      <div className={styles.metaRow}>
        <span className={styles.metaTag}>[{CATEGORY_LABEL[t.category] ?? t.category}]</span>
        {t.session_start && (
          <span className={styles.metaTag}>[session started {timeAgo(t.session_start)}]</span>
        )}
      </div>

      {/* Jitsi link — prominent when active */}
      {t.jitsi_room_url && (
        <a href={t.jitsi_room_url} target="_blank" rel="noreferrer" className={styles.jitsiBtn}>
          [jitsi] $ join --session →
        </a>
      )}

      {/* End session form */}
      {isEndingThis && (
        <div className={styles.endForm}>
          <div className={styles.endFormHeader}>
            <label className={styles.label}>// resolution_notes (optional)</label>
            <button
              type="button"
              className={styles.aiBtn}
              disabled={aiNotesLoading}
              onClick={handleAiSuggestNotes}
            >
              {aiNotesLoading ? '$ thinking...' : '$ ai --suggest-notes'}
            </button>
          </div>
          <textarea
            className={styles.textarea}
            placeholder="// summarize what was discussed / resolved…"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className={styles.formRow}>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => onEndSession(notes)}
              disabled={isPending}
            >
              {isPending ? '$ closing...' : '$ close --resolved'}
            </button>
            <button className={styles.cancelBtn} onClick={onCancelEnd}>Cancel</button>
          </div>
        </div>
      )}

      <div className={styles.ticketActions}>
        {t.status === 'assigned' && !isEndingThis && (
          <button className={styles.startBtn} onClick={onStartSession} disabled={isPending}>
            {isPending ? '$ starting...' : '$ start --session'}
          </button>
        )}
        {t.status === 'in_progress' && !isEndingThis && (
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={onOpenEndForm}
          >
            $ end --session
          </button>
        )}
        <span className={`${styles.statusBadge}`} style={{ background: `${STATUS_COLOR[t.status]}22`, color: STATUS_COLOR[t.status] }}>
          {STATUS_LABEL[t.status]}
        </span>
      </div>
    </div>
  );
}

// ── User Ticket Card ───────────────────────────────────────────────────────────

function UserTicketCard({ ticket: t }: { ticket: HelpDeskTicket }) {
  const isDone = t.status === 'resolved' || t.status === 'closed';
  const isLive = t.status === 'in_progress';
  const isAssigned = t.status === 'assigned';

  return (
    <div className={`${styles.ticket} ${isLive ? styles.ticketActive : ''} ${isDone ? styles.ticketDone : ''}`}>
      <div className={styles.ticketTop}>
        <span className={styles.statusDot} style={{ background: STATUS_COLOR[t.status] }} />
        <span className={styles.ticketTitle}>{t.title}</span>
        <span className={styles.priority} style={{ color: PRIORITY_COLOR[t.priority] }}>
          {t.priority}
        </span>
        <span className={styles.timeAgo}>{timeAgo(t.created_at)}</span>
      </div>

      <p className={styles.desc}>{t.description}</p>

      <div className={styles.metaRow}>
        <span className={`${styles.statusBadge}`} style={{ background: `${STATUS_COLOR[t.status]}22`, color: STATUS_COLOR[t.status] }}>
          {STATUS_LABEL[t.status]}
        </span>
        <span className={styles.metaTag}>[{CATEGORY_LABEL[t.category] ?? t.category}]</span>
      </div>

      {/* Assigned — waiting for mentor to start */}
      {isAssigned && (
        <div className={styles.assignedBanner}>
          [assigned] mentor en route — waiting for session to start…
          {t.jitsi_room_url && (
            <a href={t.jitsi_room_url} target="_blank" rel="noreferrer" className={styles.jitsiInline}>
              [open room] →
            </a>
          )}
        </div>
      )}

      {/* In progress — big Jitsi CTA */}
      {isLive && t.jitsi_room_url && (
        <a href={t.jitsi_room_url} target="_blank" rel="noreferrer" className={styles.jitsiBtn}>
          [jitsi] $ join --session --live →
        </a>
      )}

      {/* Resolved — show mentor notes */}
      {isDone && t.resolution_notes && (
        <div className={styles.resolutionCard}>
          <p className={styles.resolutionLabel}>// resolution_notes</p>
          <p className={styles.resolutionText}>{t.resolution_notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Ticket Form ───────────────────────────────────────────────────────────────

function TicketForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'technical',
    hackathon_id: '',
    team_id: '',
  });

  const { data: myTeams } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => teamsApi.getMyTeams().then((r) => r.data),
  });

  const { data: hackathons } = useQuery({
    queryKey: ['hackathons', 'active'],
    queryFn: () => hackathonsApi.list({ status: 'active' }).then((r) => r.data),
  });

  function handleTeamChange(teamId: string) {
    const team = myTeams?.find((t) => t.id === teamId);
    setForm((p) => ({
      ...p,
      team_id: teamId,
      hackathon_id: (team as any)?.hackathon_id ?? p.hackathon_id,
    }));
  }

  const create = useMutation({
    mutationFn: () => helpdeskApi.create(form as Parameters<typeof helpdeskApi.create>[0]),
    onSuccess: onCreated,
  });

  return (
    <div className={styles.formCard}>
      <h2 className={styles.formTitle}>// new_help_request</h2>
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <div className={styles.field}>
          <label className={styles.label}>// team</label>
          <select className={styles.input} value={form.team_id} onChange={(e) => handleTeamChange(e.target.value)} required>
            <option value="">— select your team —</option>
            {myTeams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>// hackathon</label>
          <select className={styles.input} value={form.hackathon_id} onChange={(e) => setForm((p) => ({ ...p, hackathon_id: e.target.value }))} required>
            <option value="">— select hackathon —</option>
            {hackathons?.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>// title</label>
          <input className={styles.input} placeholder="briefly describe your issue" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>// description</label>
          <textarea className={styles.textarea} placeholder="// explain what you need help with…" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={4} required />
        </div>

        <div className={styles.formRow}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>// category</label>
            <select className={styles.input} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
              <option value="technical">Backend / Technical</option>
              <option value="frontend">Frontend / Design</option>
              <option value="pitch">Pitch / Presentation</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>// priority</label>
            <select className={styles.input} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <button type="submit" className={styles.submitBtn} disabled={create.isPending}>
            {create.isPending ? '$ sending...' : '$ submit --ticket'}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>abort</button>
        </div>
      </form>
    </div>
  );
}


