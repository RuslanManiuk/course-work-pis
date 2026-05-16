import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hackathonsApi, type HackathonWinner } from '@/api/hackathons';
import { judgingApi } from '@/api/judging';
import { extractApiError } from '@/utils/apiError';
import styles from './WinnersAdmin.module.css';

interface DraftRow {
  id?: string; // existing winner id
  team_id: string;
  rank: number;
  prize: string;
  note: string;
  team_name?: string;
}

interface WinnersAdminProps {
  hackathonId: string;
  winners: HackathonWinner[];
}

function fromWinners(ws: HackathonWinner[]): DraftRow[] {
  return ws
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((w) => ({
      id: w.id,
      team_id: w.team_id,
      team_name: w.team_name,
      rank: w.rank,
      prize: w.prize ?? '',
      note: w.note ?? '',
    }));
}

export default function WinnersAdmin({ hackathonId, winners }: WinnersAdminProps) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<DraftRow[]>(fromWinners(winners));
  const [error, setError] = useState('');

  // Re-sync when winners change externally
  if (rows.length === 0 && winners.length > 0) {
    setRows(fromWinners(winners));
  }

  const { data: leaderboard } = useQuery({
    queryKey: ['hackathon-leaderboard', hackathonId],
    queryFn: () =>
      judgingApi.getLeaderboard(hackathonId, { limit: 50 }).then((r) => r.data),
  });

  const teamOptions = leaderboard?.entries ?? [];

  const upsertWinner = useMutation({
    mutationFn: (row: DraftRow) =>
      hackathonsApi.upsertWinner(hackathonId, {
        team_id: row.team_id,
        rank: row.rank,
        prize: row.prize.trim() || null,
        note: row.note.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hackathon-winners', hackathonId] });
      setError('');
    },
    onError: (e: unknown) => setError(extractApiError(e, 'Failed to save winner')),
  });

  const deleteWinner = useMutation({
    mutationFn: (winnerId: string) =>
      hackathonsApi.deleteWinner(hackathonId, winnerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hackathon-winners', hackathonId] }),
  });

  const autoSelect = useMutation({
    mutationFn: () => hackathonsApi.autoWinners(hackathonId, 3),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['hackathon-winners', hackathonId] });
      setRows(fromWinners(res.data));
      setError('');
    },
    onError: (e: unknown) => setError(extractApiError(e, 'Auto-select failed')),
  });

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((cur) => cur.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const usedRanks = new Set(rows.map((r) => r.rank));
    let nextRank = 1;
    while (usedRanks.has(nextRank)) nextRank++;
    setRows((cur) => [
      ...cur,
      { team_id: '', rank: nextRank, prize: '', note: '' },
    ]);
  }

  function saveRow(index: number) {
    const row = rows[index];
    if (!row.team_id) {
      setError('[ERR] pick a team first');
      return;
    }
    upsertWinner.mutate(row);
  }

  function removeRow(index: number) {
    const row = rows[index];
    if (row.id) deleteWinner.mutate(row.id);
    setRows((cur) => cur.filter((_, i) => i !== index));
  }

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}>// organizer · winners</span>
          <div className={styles.title}>// crown_winners</div>
        </div>
        <button
          type="button"
          className={styles.autoBtn}
          onClick={() => autoSelect.mutate()}
          disabled={autoSelect.isPending}
          title="Pick top 3 by avg judging score"
        >
          {autoSelect.isPending ? '$ running...' : '$ ai --auto-pick'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {rows.map((row, i) => (
          <div key={row.id ?? `new-${i}`} className={styles.row}>
            <input
              type="number"
              min={1}
              max={10}
              value={row.rank}
              onChange={(e) => updateRow(i, { rank: Number(e.target.value) || 1 })}
              className={styles.rankInput}
              aria-label="Rank"
            />
            <select
              value={row.team_id}
              onChange={(e) => updateRow(i, { team_id: e.target.value })}
              className={styles.select}
              aria-label="Team"
            >
              <option value="">// select team</option>
              {teamOptions.map((t) => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name} · {t.avg_score.toFixed(2)}
                </option>
              ))}
            </select>
            <input
              value={row.prize}
              onChange={(e) => updateRow(i, { prize: e.target.value })}
              placeholder="Prize (e.g. $5,000)"
              className={styles.prizeInput}
              aria-label="Prize"
            />
            <input
              value={row.note}
              onChange={(e) => updateRow(i, { note: e.target.value })}
              placeholder="// note (optional)"
              className={styles.input}
              aria-label="Note"
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => saveRow(i)}
                className={styles.saveBtn}
                disabled={upsertWinner.isPending}
              >
                save
              </button>
              <button type="button" onClick={() => removeRow(i)} className={styles.removeBtn}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className={styles.addBtn}>
        $ add --winner
      </button>
    </section>
  );
}
