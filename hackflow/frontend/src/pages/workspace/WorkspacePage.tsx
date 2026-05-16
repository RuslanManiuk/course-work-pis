import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/api/teams';
import { useKanban } from '@/hooks/useKanban';
import { extractApiError } from '@/utils/apiError';
import type { KanbanCard, CardStatus, CardLabel, Submission } from '@/types';
import RepoStatsModal from '@/components/ui/RepoStatsModal';
import PageHero, { HeroAccent } from '@/components/ui/PageHero';
import styles from './WorkspacePage.module.css';

interface WorkspacePageProps {
  teamId: string;
}

type ColumnKey = 'todo' | 'in_progress' | 'done';

const COLUMNS: { key: ColumnKey; label: string; columnClass: string; dotClass: string }[] = [
  { key: 'todo',        label: 'PROC[TODO]',   columnClass: styles.columnTodo,       dotClass: styles.columnDotTodo },
  { key: 'in_progress', label: 'PROC[ACTIVE]', columnClass: styles.columnInProgress, dotClass: styles.columnDotInProgress },
  { key: 'done',        label: 'PROC[DONE]',   columnClass: styles.columnDone,       dotClass: styles.columnDotDone },
];

const LABELS: { value: CardLabel; short: string }[] = [
  { value: 'feature',  short: 'feat' },
  { value: 'bug',      short: 'bug' },
  { value: 'design',   short: 'ui' },
  { value: 'docs',     short: 'doc' },
  { value: 'ops',      short: 'ops' },
  { value: 'research', short: 'rsch' },
];

function labelStripeClass(label: string | null | undefined): string {
  switch (label) {
    case 'feature':  return styles.cardLabelFeature;
    case 'bug':      return styles.cardLabelBug;
    case 'design':   return styles.cardLabelDesign;
    case 'docs':     return styles.cardLabelDocs;
    case 'ops':      return styles.cardLabelOps;
    case 'research': return styles.cardLabelResearch;
    default:         return '';
  }
}

function labelChipClass(label: string): string {
  switch (label) {
    case 'feature':  return styles.labelFeature;
    case 'bug':      return styles.labelBug;
    case 'design':   return styles.labelDesign;
    case 'docs':     return styles.labelDocs;
    case 'ops':      return styles.labelOps;
    case 'research': return styles.labelResearch;
    default:         return '';
  }
}

export default function WorkspacePage({ teamId }: WorkspacePageProps) {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useKanban(teamId);

  const { data, isLoading } = useQuery({
    queryKey: ['workspace', teamId],
    queryFn: () => teamsApi.getWorkspace(teamId).then((r) => r.data),
  });

  // Fetch team to get hackathon_id for submission
  const { data: team } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamsApi.get(teamId).then((r) => r.data),
  });

  const createCard = useMutation({
    mutationFn: (title: string) =>
      teamsApi.createCard(teamId, { title, status: 'todo' as CardStatus }),
    onSuccess: () => {
      setNewTitle('');
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['workspace', teamId] });
    },
  });

  const moveCard = useMutation({
    mutationFn: ({ cardId, status }: { cardId: string; status: CardStatus }) =>
      teamsApi.updateCard(teamId, cardId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace', teamId] }),
  });

  const setLabel = useMutation({
    mutationFn: ({ cardId, label }: { cardId: string; label: string | null }) =>
      teamsApi.updateCard(teamId, cardId, { label } as Partial<KanbanCard>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace', teamId] }),
  });

  const deleteCard = useMutation({
    mutationFn: (cardId: string) => teamsApi.deleteCard(teamId, cardId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace', teamId] }),
  });

  if (isLoading) return <p className={styles.loading}>Loading board…</p>;
  if (!data) return null;

  const totalCards =
    data.board.todo.length + data.board.in_progress.length + data.board.done.length;
  const doneCount = data.board.done.length;

  return (
    <div className={styles.root}>
      <PageHero
        compact
        eyebrow={team?.name ? `$ cd teams/${team.name}/workspace` : '$ cd workspace'}
        title={<>$ git push origin <HeroAccent>main</HeroAccent></>}
        subtitle={
          totalCards > 0
            ? `[${doneCount}/${totalCards}] tasks committed · keep shipping`
            : '// kanban board · plan, track and ship your hackathon project'
        }
        actions={
          <button className={styles.addBtn} onClick={() => setAdding(true)}>
            $ touch card
          </button>
        }
      />

      {adding && (
        <form
          className={styles.addForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) createCard.mutate(newTitle.trim());
          }}
        >
          <input
            autoFocus
            className={styles.addInput}
            placeholder="$ echo 'card title'…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className={styles.addSubmit}>create</button>
          <button type="button" className={styles.addCancel} onClick={() => setAdding(false)}>abort</button>
        </form>
      )}

      <div className={styles.board}>
        {COLUMNS.map((col) => (
          <div key={col.key} className={`${styles.column} ${col.columnClass}`}>
            <div className={styles.columnHeader}>
              <span className={styles.columnTitle}>
                <span className={`${styles.columnDot} ${col.dotClass}`} />
                {col.label}
              </span>
              <span className={styles.columnCount}>
                {data.board[col.key].length}
              </span>
            </div>
            <div className={styles.cards}>
              {data.board[col.key].map((card: KanbanCard) => (
                <KanbanCardItem
                  key={card.id}
                  card={card}
                  onMove={(status) => moveCard.mutate({ cardId: card.id, status })}
                  onDelete={() => deleteCard.mutate(card.id)}
                  onSetLabel={(label) =>
                    setLabel.mutate({ cardId: card.id, label })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {team && (
        <SubmissionPanel teamId={teamId} hackathonId={team.hackathon_id} />
      )}
    </div>
  );
}

function KanbanCardItem({
  card,
  onMove,
  onDelete,
  onSetLabel,
}: {
  card: KanbanCard;
  onMove: (status: CardStatus) => void;
  onDelete: () => void;
  onSetLabel: (label: string | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const priorityColor = card.priority >= 4 ? 'var(--color-danger)' :
    card.priority >= 3 ? 'var(--color-warning)' : 'var(--color-accent)';

  const nextStatus: Record<CardStatus, CardStatus | null> = {
    todo: 'in_progress',
    in_progress: 'done',
    done: null,
  };

  return (
    <div className={`${styles.card} ${labelStripeClass(card.label)}`}>
      <div className={styles.cardTop}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {card.label && (
            <button
              type="button"
              className={`${styles.labelChip} ${labelChipClass(card.label)}`}
              onClick={() => setPickerOpen((v) => !v)}
              title="Change label"
            >
              <span className={styles.labelDot} />
              {card.label}
            </button>
          )}
          {!card.label && (
            <button
              type="button"
              className={styles.labelChip}
              onClick={() => setPickerOpen((v) => !v)}
              style={{ color: 'var(--text-muted)' }}
              title="Add label"
            >
              + label
            </button>
          )}
          <span className={styles.priority} style={{ color: priorityColor }}>
            {'●'.repeat(card.priority)}
          </span>
        </div>
        <button className={styles.deleteBtn} onClick={onDelete} title="Delete card">×</button>
      </div>

      {pickerOpen && (
        <div className={styles.labelPicker}>
          {LABELS.map((l) => (
            <button
              key={l.value}
              type="button"
              className={`${styles.labelPickerBtn} ${labelChipClass(l.value)} ${
                card.label === l.value ? styles.labelPickerBtnActive : ''
              }`}
              onClick={() => {
                onSetLabel(card.label === l.value ? null : l.value);
                setPickerOpen(false);
              }}
            >
              {l.short}
            </button>
          ))}
          {card.label && (
            <button
              type="button"
              className={styles.labelPickerBtn}
              onClick={() => {
                onSetLabel(null);
                setPickerOpen(false);
              }}
            >
              clear
            </button>
          )}
        </div>
      )}

      <p className={styles.cardTitle}>{card.title}</p>
      {card.description && <p className={styles.cardDesc}>{card.description}</p>}
      {card.due_date && (
        <p className={styles.dueDate}>
          deadline: {new Date(card.due_date).toLocaleDateString()}
        </p>
      )}
      {nextStatus[card.status] && (
        <button
          className={styles.moveBtn}
          onClick={() => onMove(nextStatus[card.status]!)}
        >
          mv → [{nextStatus[card.status]?.toUpperCase().replace('_', '_')}]
        </button>
      )}
    </div>
  );
}

// ── Submission Panel ──────────────────────────────────────────────────────────

function SubmissionPanel({ teamId, hackathonId }: { teamId: string; hackathonId: string }) {
  const qc = useQueryClient();
  const [repoUrl, setRepoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [videoPitchUrl, setVideoPitchUrl] = useState('');
  const [presentationUrl, setPresentationUrl] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const { data: submission, isLoading } = useQuery({
    queryKey: ['submission', teamId],
    queryFn: async () => {
      try {
        const r = await teamsApi.getSubmission(teamId);
        return r.data as Submission;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
  });

  const { data: repoStats } = useQuery({
    queryKey: ['repoStats', teamId],
    queryFn: async () => {
      const r = await teamsApi.getRepoStats(teamId);
      return r.data;
    },
    enabled: !!submission,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => {
      if (description.trim().length < 20) {
        return Promise.reject(new Error('Description must be at least 20 characters'));
      }
      return teamsApi.createSubmission(teamId, {
        hackathon_id: hackathonId,
        repository_url: repoUrl.trim(),
        description: description.trim(),
        repo_is_private: isPrivate,
        ...(videoPitchUrl.trim() ? { video_pitch_url: videoPitchUrl.trim() } : {}),
        ...(presentationUrl.trim() ? { presentation_url: presentationUrl.trim() } : {}),
      });
    },
    onSuccess: () => {
      setShowForm(false);
      setError('');
      qc.invalidateQueries({ queryKey: ['submission', teamId] });
    },
    onError: (e: any) => {
      if (e instanceof Error) { setError(e.message); return; }
      setError(extractApiError(e, 'Failed to submit'));
    },
  });

  const update = useMutation({
    mutationFn: () => {
      if (!submission) return Promise.reject(new Error('No submission'));
      return teamsApi.updateSubmission(teamId, submission.id, {
        repository_url: repoUrl.trim() || undefined,
        description: description.trim() || undefined,
        repo_is_private: isPrivate,
        video_pitch_url: videoPitchUrl.trim() || undefined,
        presentation_url: presentationUrl.trim() || undefined,
      });
    },
    onSuccess: () => {
      setShowForm(false);
      setIsEditing(false);
      setError('');
      qc.invalidateQueries({ queryKey: ['submission', teamId] });
    },
    onError: (e: any) => {
      setError(extractApiError(e, 'Failed to update'));
    },
  });

  function startEdit() {
    if (!submission) return;
    setRepoUrl(submission.repository_url);
    setDescription(submission.description);
    setIsPrivate(submission.repo_is_private);
    setVideoPitchUrl(submission.video_pitch_url ?? '');
    setPresentationUrl(submission.presentation_url ?? '');
    setError('');
    setIsEditing(true);
    setShowForm(true);
  }

  const verify = useMutation({
    mutationFn: () => teamsApi.verifyRepoAccess(teamId, submission!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submission', teamId] }),
    onError: (e: any) => {
      setError(extractApiError(e, 'Verification failed'));
    },
  });

  if (isLoading) return null;

  const accessStatus = submission?.repo_access_status;
  const needsAction = submission?.repo_is_private && (accessStatus === 'pending' || accessStatus === 'access_lost');

  return (
    <div className={styles.submissionPanel}>
      <div className={styles.submissionHeader}>
        <h2 className={styles.submissionTitle}>// project submission</h2>
        {!submission && !showForm && (
          <button className={styles.addBtn} onClick={() => setShowForm(true)}>
            $ git push --submit
          </button>
        )}
        {submission && !showForm && (
          <button className={styles.editBtn} onClick={startEdit}>
            [edit]
          </button>
        )}
      </div>

      {submission && (
        <div className={styles.submissionCard}>
          <div className={styles.submissionMeta}>
            <span className={`${styles.statusBadge} ${styles[submission.status]}`}>
              {submission.status.replace('_', ' ')}
            </span>
            <span className={styles.repoPrivacyBadge}>
              {submission.repo_is_private ? '[private]' : '[public]'}
            </span>
          </div>

          <a className={styles.repoLink} href={submission.repository_url} target="_blank" rel="noreferrer">
            {submission.repository_url}
          </a>
          <p className={styles.submissionDesc}>{submission.description}</p>

          {(submission.video_pitch_url || submission.presentation_url) && (
            <div className={styles.submissionLinks}>
              {submission.video_pitch_url && (
                <a href={submission.video_pitch_url} target="_blank" rel="noreferrer" className={styles.pitchLink}>
                  🎬 Video Demo
                </a>
              )}
              {submission.presentation_url && (
                <a href={submission.presentation_url} target="_blank" rel="noreferrer" className={styles.pitchLink}>
                  📊 Presentation
                </a>
              )}
            </div>
          )}

          {repoStats && (
            <div className={styles.repoStatsPreview}>
              <div className={styles.repoStatsRow}>
                {repoStats.language && (
                  <span className={styles.repoStatItem}>
                    <span className={styles.langDotInline} style={{
                      background: ({Python:'#3572A5',TypeScript:'#3178c6',JavaScript:'#f1e05a',Go:'#00ADD8',Java:'#b07219',HTML:'#e34c26',CSS:'#563d7c',Rust:'#dea584'} as Record<string,string>)[repoStats.language] ?? '#6c63ff'
                    }} />
                    {repoStats.language}
                  </span>
                )}
                <span className={styles.repoStatItem}>★ {repoStats.stars}</span>
                <span className={styles.repoStatItem}>⑂ {repoStats.forks}</span>
                <span className={styles.repoStatItem}>{repoStats.commit_count} commits</span>
                <span className={styles.repoStatItem}>{repoStats.contributors_count} contributors</span>
              </div>
              <button className={styles.statsBtn} onClick={() => setShowStats(true)}>
                git log --stat →
              </button>
            </div>
          )}

          {showStats && repoStats && (
            <RepoStatsModal stats={repoStats as any} onClose={() => setShowStats(false)} />
          )}

          {needsAction && (
            <div className={styles.accessWarning}>
              {accessStatus === 'access_lost' ? (
                <p>[ERR] access_lost — bot was removed from repository</p>
              ) : (
                <p>[WARN] access_pending — add <code>hackflow-bot</code> as collaborator with Read access, then retry</p>
              )}
              <button
                className={styles.retryBtn}
                onClick={() => verify.mutate()}
                disabled={verify.isPending}
              >
                {verify.isPending ? '$ checking...' : '$ retry --verify-access'}
              </button>
              {error && <p className={styles.formError}>{error}</p>}
            </div>
          )}

          {accessStatus === 'accessible' && submission.repo_is_private && (
            <p className={styles.accessOk}>[ OK ] bot access verified</p>
          )}
        </div>
      )}

      {showForm && (
        <form
          className={styles.submissionForm}
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (isEditing) update.mutate();
            else create.mutate();
          }}
        >
          <label className={styles.formLabel}>// repository URL</label>
          <input
            className={styles.formInput}
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            required
          />

          <label className={styles.formLabel}>
            // description (min 20 chars)
            {description.trim().length > 0 && description.trim().length < 20 && (
              <span style={{ color: 'var(--color-danger)', marginLeft: '0.5rem', fontSize: '0.8em' }}>
                {description.trim().length}/20
              </span>
            )}
          </label>
          <textarea
            className={styles.formTextarea}
            placeholder="Describe your project…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            minLength={20}
          />

          <label className={styles.formLabel}>// video demo URL <span style={{color:'var(--text-muted)',fontWeight:'normal',letterSpacing:'0.06em'}}>(optional — YouTube / Loom)</span></label>
          <input
            className={styles.formInput}
            placeholder="https://youtube.com/watch?v=..."
            value={videoPitchUrl}
            onChange={(e) => setVideoPitchUrl(e.target.value)}
            type="url"
          />

          <label className={styles.formLabel}>// presentation URL <span style={{color:'var(--text-muted)',fontWeight:'normal',letterSpacing:'0.06em'}}>(optional — Google Slides / Canva)</span></label>
          <input
            className={styles.formInput}
            placeholder="https://docs.google.com/presentation/..."
            value={presentationUrl}
            onChange={(e) => setPresentationUrl(e.target.value)}
            type="url"
          />

          <div className={styles.toggleRow}>
            <span className={styles.formLabel}>// repo visibility</span>
            <div className={styles.toggle}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${!isPrivate ? styles.toggleActive : ''}`}
                onClick={() => setIsPrivate(false)}
              >
                [public]
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${isPrivate ? styles.toggleActive : ''}`}
                onClick={() => setIsPrivate(true)}
              >
                [private]
              </button>
            </div>
          </div>

          {isPrivate && (
            <div className={styles.privateNotice}>
              Please add our bot <code>hackflow-bot</code> as a collaborator with <strong>Read</strong> access
              to your repository before submitting. Only then we can validate your activity.
            </div>
          )}

          {error && <p className={styles.formError}>{error}</p>}

          <div className={styles.formActions}>
            <button type="submit" className={styles.addBtn} disabled={create.isPending || update.isPending}>
              {isEditing
                ? (update.isPending ? '$ saving...' : '$ git commit --amend')
                : (create.isPending ? '$ pushing...' : '$ git push --submit')}
            </button>
            <button type="button" className={styles.addCancel} onClick={() => { setShowForm(false); setIsEditing(false); setError(''); }}>
              abort
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
