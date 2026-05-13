import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { hackathonsApi } from '@/api/hackathons';
import { judgingApi } from '@/api/judging';
import { useAuthStore } from '@/store/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { extractApiError } from '@/utils/apiError';
import type { EvaluationCriteria, LeaderboardEntry } from '@/types';
import styles from './JudgingPage.module.css';

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

export default function JudgingPage() {
  const { hackathonId = '' } = useParams<{ hackathonId: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  // Live leaderboard via WebSocket
  useWebSocket(`/hackathon/${hackathonId}`, {
    'leaderboard:updated': () => {
      qc.invalidateQueries({ queryKey: ['leaderboard', hackathonId] });
      qc.invalidateQueries({ queryKey: ['judging-submissions', hackathonId] });
    },
  });

  useEffect(() => {
    if (!selectedSubmission) { setAiSummary(''); return; }
    let cancelled = false;
    setAiSummaryLoading(true);
    setAiSummary('');
    judgingApi.aiSummary(selectedSubmission)
      .then((res) => { if (!cancelled) setAiSummary(res.data.summary); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAiSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSubmission]);

  const { data: submissions } = useQuery({
    queryKey: ['judging-submissions', hackathonId],
    queryFn: () => judgingApi.getSubmissionsForJudging(hackathonId).then((r) => r.data),
    enabled: !!hackathonId,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', hackathonId],
    queryFn: () => judgingApi.getLeaderboard(hackathonId).then((r) => r.data),
    enabled: !!hackathonId,
    refetchInterval: 15_000,
  });

  const { data: criteria } = useQuery({
    queryKey: ['criteria', hackathonId],
    queryFn: () => hackathonsApi.getCriteria(hackathonId).then((r) => r.data),
    enabled: !!hackathonId,
  });

  // Build submissionId → teamName lookup from leaderboard data
  const submissionTeamMap = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const entry of leaderboard?.entries ?? []) {
      if (entry.submission_id) {
        map[entry.submission_id] = entry.team_name;
      }
    }
    return map;
  }, [leaderboard]);

  // Full data for selected submission (from submissions list query)
  const selectedSubmissionData = React.useMemo(() => {
    return submissions?.find((s) => s.submission_id === selectedSubmission) ?? null;
  }, [submissions, selectedSubmission]);

  function handleDone() {
    qc.invalidateQueries({ queryKey: ['leaderboard', hackathonId] });
    qc.invalidateQueries({ queryKey: ['judging-submissions', hackathonId] });
    setSelectedSubmission(null);
  }

  async function handleAiQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    setAiAnswer('');
    setAiError('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/v1/ai-assistant/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ hackathon_id: hackathonId, question: aiQuery }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body?.detail ?? `HTTP ${res.status}`;
        setAiError(typeof detail === 'string' ? detail : 'AI assistant unavailable. Check server configuration.');
        setAiLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setAiLoading(false); return; }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const chunk = line.slice(6);
            if (chunk === '[DONE]') break;
            setAiAnswer((prev) => prev + chunk);
          }
        }
      }
    } catch {
      setAiError('Could not reach the AI assistant. Make sure the backend is running.');
    }
    setAiLoading(false);
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Judging Panel</h1>

      <div className={styles.grid}>
        {/* Submissions list */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Submissions to Review</h2>
          <div className={styles.subList}>
            {submissions?.map((s) => (
              <button
                key={s.submission_id}
                className={
                  selectedSubmission === s.submission_id
                    ? `${styles.subItem} ${styles.subItemActive}`
                    : styles.subItem
                }
                onClick={() => setSelectedSubmission(s.submission_id)}
              >
                <span className={styles.subId}>
                  {submissionTeamMap[s.submission_id] ?? s.team_name ?? s.submission_id.slice(0, 8) + '…'}
                </span>
                {s.scored_by_me && <span className={styles.scoredBadge}>✓ scored</span>}
              </button>
            ))}
            {!submissions?.length && (
              <p className={styles.empty}>No submissions yet.</p>
            )}
          </div>
        </section>

        {/* Submission detail + scoring */}
        {selectedSubmission && criteria && (
          <div className={styles.scoringColumn}>
            {/* Project detail */}
            {selectedSubmissionData && (
              <div className={styles.submissionDetail}>
                <h3 className={styles.submissionDetailTitle}>
                  {submissionTeamMap[selectedSubmission] ?? selectedSubmissionData.team_name ?? 'Project'}
                </h3>
                {selectedSubmissionData.description && (
                  <p className={styles.submissionDetailDesc}>{selectedSubmissionData.description}</p>
                )}
                <div className={styles.submissionLinks}>
                  {selectedSubmissionData.repository_url && (
                    <a
                      href={selectedSubmissionData.repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.submissionLink}
                    >
                      <GitHubIcon /> GitHub Repository
                    </a>
                  )}
                  {selectedSubmissionData.video_pitch_url && (
                    <a
                      href={selectedSubmissionData.video_pitch_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.submissionLink}
                    >
                      🎬 Video Demo
                    </a>
                  )}
                  {selectedSubmissionData.presentation_url && (
                    <a
                      href={selectedSubmissionData.presentation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.submissionLink}
                    >
                      📊 Presentation
                    </a>
                  )}
                </div>
                {selectedSubmissionData.submitted_at && (
                  <span className={styles.submittedAt}>
                    Submitted {new Date(selectedSubmissionData.submitted_at).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {(aiSummaryLoading || aiSummary) && (
              <div className={styles.aiSummaryCard}>
                <span className={styles.aiSummaryLabel}>✨ AI Snapshot</span>
                {aiSummaryLoading
                  ? <span className={styles.aiSummaryText} style={{ opacity: 0.5 }}>Generating summary…</span>
                  : <span className={styles.aiSummaryText}>{aiSummary}</span>
                }
              </div>
            )}
            <ScoringForm
              submissionId={selectedSubmission}
              criteria={criteria}
              hackathonId={hackathonId}
              teamName={submissionTeamMap[selectedSubmission]}
              onDone={handleDone}
            />
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Leaderboard</h2>
        <div className={styles.leaderboard}>
          {leaderboard?.entries.map((e: LeaderboardEntry) => (
            <div key={e.team_id} className={styles.lbRow}>
              <span className={styles.lbRank}>#{e.rank}</span>
              <span className={styles.lbTeam}>{e.team_name}</span>
              <span className={styles.lbScore}>
                {e.avg_score != null ? e.avg_score.toFixed(2) : '—'}
              </span>
            </div>
          ))}
          {!leaderboard?.entries.length && (
            <p className={styles.empty}>No scores yet.</p>
          )}
        </div>
      </section>

      {/* AI Assistant */}
      {(user?.role === 'judge' || user?.role === 'organizer') && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>AI Assistant</h2>
          <form onSubmit={handleAiQuery} className={styles.aiForm}>
            <input
              className={styles.aiInput}
              placeholder="Ask about submissions…"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
            />
            <button type="submit" className={styles.aiBtn} disabled={aiLoading}>
              {aiLoading ? 'Thinking…' : 'Ask'}
            </button>
          </form>
          {aiAnswer && (
            <div className={styles.aiAnswer}>
              <p>{aiAnswer}</p>
            </div>
          )}
          {aiError && (
            <div className={styles.aiError}>
              <p>⚠️ {aiError}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ScoringForm({
  submissionId,
  criteria,
  hackathonId,
  teamName,
  onDone,
}: {
  submissionId: string;
  criteria: EvaluationCriteria[];
  hackathonId: string;
  teamName?: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [scores, setScores] = useState<Record<string, { score: number; feedback: string }>>(
    Object.fromEntries(criteria.map((c) => [c.id, { score: 5, feedback: '' }]))
  );
  const [aiScoring, setAiScoring] = useState(false);
  const [aiScoreError, setAiScoreError] = useState('');
  const [aiApplied, setAiApplied] = useState(false);

  async function handleAiAutoScore() {
    setAiScoring(true);
    setAiScoreError('');
    try {
      const res = await judgingApi.aiEvaluate(submissionId);
      const aiScores = res.data.scores;
      setScores((prev) => {
        const next = { ...prev };
        for (const s of aiScores) {
          if (next[s.criteria_id] !== undefined) {
            next[s.criteria_id] = {
              score: Math.min(s.score, criteria.find((c) => c.id === s.criteria_id)?.max_score ?? 10),
              feedback: s.feedback,
            };
          }
        }
        return next;
      });
      setAiApplied(true);
      setTimeout(() => setAiApplied(false), 3000);
    } catch (e: unknown) {
      setAiScoreError(extractApiError(e, 'AI evaluation failed'));
    } finally {
      setAiScoring(false);
    }
  }

  const evaluate = useMutation({
    mutationFn: () =>
      judgingApi.evaluate(
        submissionId,
        Object.entries(scores).map(([criteria_id, v]) => ({ criteria_id, ...v })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaderboard', hackathonId] });
      qc.invalidateQueries({ queryKey: ['judging-submissions', hackathonId] });
      onDone();
    },
  });

  return (
    <section className={styles.section}>
      <div className={styles.scoringHeader}>
        <h2 className={styles.sectionTitle}>
          Score: {teamName ?? submissionId.slice(0, 8) + '…'}
        </h2>
        <button
          type="button"
          className={styles.aiAutoBtn}
          disabled={aiScoring}
          onClick={handleAiAutoScore}
        >
          {aiScoring ? '⏳ AI Scoring…' : '✨ AI Auto-Score'}
        </button>
      </div>
      {aiApplied && <p className={styles.aiApplied}>✅ AI scores applied — review and adjust before submitting</p>}
      {aiScoreError && <p className={styles.aiScoreError}>⚠️ {aiScoreError}</p>}
      <form
        className={styles.scoreForm}
        onSubmit={(e) => {
          e.preventDefault();
          evaluate.mutate();
        }}
      >
        {criteria.map((c) => (
          <div key={c.id} className={styles.criteriaRow}>
            <div className={styles.criteriaLabel}>
              <span>{c.name}</span>
              <span className={styles.criteriaWeight}>weight {c.weight}</span>
            </div>
            <input
              type="range"
              min={1}
              max={c.max_score ?? 10}
              value={scores[c.id]?.score ?? 5}
              onChange={(e) =>
                setScores((p) => ({
                  ...p,
                  [c.id]: { ...p[c.id], score: Number(e.target.value) },
                }))
              }
              className={styles.slider}
            />
            <span className={styles.scoreVal}>{scores[c.id]?.score}/{c.max_score ?? 10}</span>
            <input
              placeholder="Feedback (optional)"
              className={styles.feedbackInput}
              value={scores[c.id]?.feedback}
              onChange={(e) =>
                setScores((p) => ({
                  ...p,
                  [c.id]: { ...p[c.id], feedback: e.target.value },
                }))
              }
            />
          </div>
        ))}
        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn} disabled={evaluate.isPending}>
            {evaluate.isPending ? 'Submitting…' : 'Submit Scores'}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onDone}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
