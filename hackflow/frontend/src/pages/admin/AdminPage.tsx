import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { hackathonsApi, type HackathonCreatePayload } from '@/api/hackathons';
import { useAuthStore } from '@/store/authStore';
import { Navigate } from 'react-router-dom';
import { extractApiError } from '@/utils/apiError';
import type { Hackathon, EvaluationCriteria, UserRole } from '@/types';
import PageHero, { HeroAccent } from '@/components/ui/PageHero';
import styles from './AdminPage.module.css';

const ROLE_OPTIONS: UserRole[] = ['hacker', 'mentor', 'judge', 'organizer'];

export default function AdminPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  // Guard: only organizers
  if (user && user.role !== 'organizer') {
    return <Navigate to="/dashboard" replace />;
  }

  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [broadcastForm, setBroadcastForm] = useState({
    hackathon_id: '',
    title: '',
    message: '',
  });
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [showCreateHackathon, setShowCreateHackathon] = useState(false);
  const [criteriaHackathon, setCriteriaHackathon] = useState<Hackathon | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', roleFilter],
    queryFn: () =>
      adminApi.listUsers(roleFilter ? { role: roleFilter as UserRole } : undefined).then((r) => r.data),
  });

  const { data: hackathons } = useQuery({
    queryKey: ['hackathons'],
    queryFn: () => hackathonsApi.list().then((r) => r.data),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: UserRole; is_active?: boolean } }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const updateHackathonStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      hackathonsApi.update(id, { status } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hackathons'] }),
  });

  const STATUS_NEXT: Record<string, { label: string; next: string } | null> = {
    draft: { label: '→ Upcoming', next: 'upcoming' },
    upcoming: { label: '→ Active', next: 'active' },
    active: { label: '→ Completed', next: 'completed' },
    completed: null,
    cancelled: null,
  };

  const broadcast = useMutation({
    mutationFn: () =>
      adminApi.broadcast({
        hackathon_id: broadcastForm.hackathon_id || null,
        title: broadcastForm.title,
        message: broadcastForm.message,
      }),
    onSuccess: () => {
      setBroadcastSent(true);
      setBroadcastForm({ hackathon_id: '', title: '', message: '' });
      setTimeout(() => setBroadcastSent(false), 3000);
    },
  });

  const userCount = users?.length ?? 0;
  const hackathonCount = hackathons?.length ?? 0;
  const activeHackathons = hackathons?.filter((h: Hackathon) => h.status === 'active').length ?? 0;

  return (
    <div className={styles.root}>
      <PageHero
        eyebrow="Organizer console"
        title={<>Run the <HeroAccent>show</HeroAccent>.</>}
        subtitle="Manage users, hackathons, criteria and broadcast announcements across the platform."
      />

      {/* KPI strip */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiItem}>
          <div className={styles.kpiNumber}>{userCount}</div>
          <div className={styles.kpiLabel}>Users</div>
        </div>
        <div className={styles.kpiItem}>
          <div className={styles.kpiNumber}>{hackathonCount}</div>
          <div className={styles.kpiLabel}>Hackathons</div>
        </div>
        <div className={styles.kpiItem}>
          <div className={styles.kpiNumber}>{activeHackathons}</div>
          <div className={styles.kpiLabel}>Live now</div>
        </div>
      </div>

      {/* ── Users Table ───────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Users</h2>
          <div className={styles.filters}>
            <select
              className={styles.select}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && <p className={styles.loading}>Loading users…</p>}

        {!isLoading && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Active</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className={!u.is_active ? styles.inactiveRow : ''}>
                    <td className={styles.usernameCell}>
                      {u.avatar_url && (
                        <img src={u.avatar_url} alt="" className={styles.avatar} />
                      )}
                      <span>{u.username}</span>
                    </td>
                    <td className={styles.emailCell}>{u.email}</td>
                    <td>
                      <select
                        className={styles.inlineSelect}
                        value={u.role}
                        onChange={(e) =>
                          updateUser.mutate({ id: u.id, data: { role: e.target.value as UserRole } })
                        }
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className={u.is_active ? styles.toggleActive : styles.toggleInactive}
                        onClick={() =>
                          updateUser.mutate({ id: u.id, data: { is_active: !u.is_active } })
                        }
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className={styles.dateCell}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users?.length === 0 && (
              <p className={styles.empty}>No users found.</p>
            )}
          </div>
        )}
      </section>

      {/* ── Broadcast ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Send Broadcast Notification</h2>

        <div className={styles.broadcastCard}>
          <label className={styles.label}>Hackathon (optional — omit to send to all active users)</label>
          <select
            className={styles.select}
            value={broadcastForm.hackathon_id}
            onChange={(e) => setBroadcastForm((f) => ({ ...f, hackathon_id: e.target.value }))}
          >
            <option value="">All active users</option>
            {hackathons?.map((h) => (
              <option key={h.id} value={h.id}>{h.title}</option>
            ))}
          </select>

          <label className={styles.label}>Title</label>
          <input
            className={styles.input}
            placeholder="Notification title"
            value={broadcastForm.title}
            onChange={(e) => setBroadcastForm((f) => ({ ...f, title: e.target.value }))}
          />

          <label className={styles.label}>Message</label>
          <textarea
            className={styles.textarea}
            placeholder="Notification body…"
            rows={4}
            value={broadcastForm.message}
            onChange={(e) => setBroadcastForm((f) => ({ ...f, message: e.target.value }))}
          />

          {broadcastSent && (
            <p className={styles.success}>Broadcast queued successfully!</p>
          )}

          <button
            className={styles.primaryBtn}
            onClick={() => broadcast.mutate()}
            disabled={!broadcastForm.title.trim() || !broadcastForm.message.trim() || broadcast.isPending}
          >
            {broadcast.isPending ? 'Sending…' : 'Send Broadcast'}
          </button>
        </div>
      </section>

      {/* ── Hackathons ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Hackathons</h2>
          <button className={styles.primaryBtn} onClick={() => setShowCreateHackathon(true)}>
            + Create Hackathon
          </button>
        </div>

        <div className={styles.hackathonGrid}>
          {hackathons?.map((h) => (
            <div key={h.id} className={styles.hackathonCard}>
              <div className={styles.hackathonTop}>
                <span className={`${styles.statusDot} ${styles[`dot_${h.status}`]}`} />
                <span className={styles.hackathonTitle}>{h.title}</span>
                <span className={`${styles.hStatusBadge} ${styles[`hStatus_${h.status}`]}`}>{h.status}</span>
              </div>
              <p className={styles.hackathonDesc}>{h.description.slice(0, 100)}{h.description.length > 100 ? '…' : ''}</p>
              <div className={styles.hackathonMeta}>
                <span>Ends {new Date(h.end_date).toLocaleDateString()}</span>
                <span>Sub deadline {new Date(h.submission_deadline).toLocaleDateString()}</span>
              </div>
              <div className={styles.hackathonActions}>
                <button
                  className={styles.ghostBtn}
                  onClick={() => setCriteriaHackathon(h)}
                >
                  ⚖ Manage Criteria
                </button>
                {STATUS_NEXT[h.status] && (
                  <button
                    className={styles.statusAdvanceBtn}
                    disabled={updateHackathonStatus.isPending}
                    onClick={() => updateHackathonStatus.mutate({ id: h.id, status: STATUS_NEXT[h.status]!.next })}
                  >
                    {STATUS_NEXT[h.status]!.label}
                  </button>
                )}
              </div>
            </div>
          ))}
          {!hackathons?.length && (
            <p className={styles.empty}>No hackathons yet. Create one above.</p>
          )}
        </div>
      </section>

      {showCreateHackathon && (
        <HackathonModal
          onClose={() => setShowCreateHackathon(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['hackathons'] });
            setShowCreateHackathon(false);
          }}
        />
      )}

      {criteriaHackathon && (
        <CriteriaModal
          hackathon={criteriaHackathon}
          onClose={() => setCriteriaHackathon(null)}
        />
      )}
    </div>
  );
}

// ── Create Hackathon Modal ────────────────────────────────────────────────────

function HackathonModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const tomorrow = new Date(now.getTime() + 86_400_000);
  const inAWeek = new Date(now.getTime() + 7 * 86_400_000);
  const inSixDays = new Date(now.getTime() + 6 * 86_400_000);

  const [form, setForm] = useState<HackathonCreatePayload>({
    title: '',
    description: '',
    start_date: fmtLocal(tomorrow),
    end_date: fmtLocal(inAWeek),
    submission_deadline: fmtLocal(inSixDays),
    registration_deadline: fmtLocal(tomorrow),
    max_team_size: 5,
    min_team_size: 1,
  });
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState('');
  const [aiDescLoading, setAiDescLoading] = useState(false);

  async function handleAiDescribe() {
    if (!form.title.trim()) return;
    setAiDescLoading(true);
    try {
      const res = await hackathonsApi.aiDescribe(form.title);
      setForm((f) => ({ ...f, description: res.data.description }));
    } catch {
      // fail silently — user can type manually
    } finally {
      setAiDescLoading(false);
    }
  }

  const create = useMutation({
    mutationFn: () => {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
      return hackathonsApi.create({ ...form, tags: tags.length ? tags : undefined });
    },
    onSuccess: onCreated,
    onError: (e: any) => {
      setError(extractApiError(e, 'Failed to create'));
    },
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Create Hackathon</h2>

        <label className={styles.label}>Title</label>
        <input
          className={styles.input}
          placeholder="e.g. HackFlow 2026"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />

        <div className={styles.criteriaAiBar} style={{ marginBottom: 4 }}>
          <span className={styles.label} style={{ margin: 0 }}>Description</span>
          <button
            type="button"
            className={styles.aiBtn}
            disabled={aiDescLoading || !form.title.trim()}
            onClick={handleAiDescribe}
            title={!form.title.trim() ? 'Enter a title first' : undefined}
          >
            {aiDescLoading ? '⏳ Generating…' : '✨ Generate with AI'}
          </button>
        </div>
        <textarea
          className={styles.textarea}
          rows={3}
          placeholder="What is this hackathon about?"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />

        <div className={styles.formRow}>
          <div>
            <label className={styles.label}>Start date</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>
          <div>
            <label className={styles.label}>End date</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div>
            <label className={styles.label}>Registration deadline</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={form.registration_deadline}
              onChange={(e) => setForm((f) => ({ ...f, registration_deadline: e.target.value }))}
            />
          </div>
          <div>
            <label className={styles.label}>Submission deadline</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={form.submission_deadline}
              onChange={(e) => setForm((f) => ({ ...f, submission_deadline: e.target.value }))}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div>
            <label className={styles.label}>Min team size</label>
            <input
              type="number"
              min={1}
              max={20}
              className={styles.input}
              value={form.min_team_size}
              onChange={(e) => setForm((f) => ({ ...f, min_team_size: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className={styles.label}>Max team size</label>
            <input
              type="number"
              min={1}
              max={20}
              className={styles.input}
              value={form.max_team_size}
              onChange={(e) => setForm((f) => ({ ...f, max_team_size: Number(e.target.value) }))}
            />
          </div>
        </div>

        <label className={styles.label}>Tags (comma-separated)</label>
        <input
          className={styles.input}
          placeholder="AI, Python, Web3"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />

        <label className={styles.label}>Banner URL (optional)</label>
        <input
          className={styles.input}
          placeholder="https://…"
          value={form.banner_url ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, banner_url: e.target.value || undefined }))}
        />

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.modalActions}>
          <button
            className={styles.primaryBtn}
            onClick={() => create.mutate()}
            disabled={!form.title.trim() || !form.description.trim() || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create Hackathon'}
          </button>
          <button className={styles.ghostBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Criteria Modal ────────────────────────────────────────────────────────────

function CriteriaModal({ hackathon, onClose }: { hackathon: Hackathon; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: criteria, isLoading } = useQuery({
    queryKey: ['criteria', hackathon.id],
    queryFn: () => hackathonsApi.getCriteria(hackathon.id).then((r) => r.data),
  });

  const [newCriteria, setNewCriteria] = useState([
    { name: '', description: '', weight: 25, max_score: 10, order: 1 },
  ]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState('');

  const addCriteria = useMutation({
    mutationFn: () =>
      hackathonsApi.addCriteria(
        hackathon.id,
        newCriteria.filter((c) => c.name.trim()),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['criteria', hackathon.id] });
      setNewCriteria([{ name: '', description: '', weight: 25, max_score: 10, order: 1 }]);
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: any) => {
      setError(extractApiError(e, 'Failed to add criteria'));
    },
  });

  async function handleGenerateWithAI() {
    setAiGenerating(true);
    setAiStatus('');
    setError('');
    try {
      const res = await hackathonsApi.generateCriteria(hackathon.id, 5);
      const suggestions = res.data.suggestions;
      setNewCriteria(
        suggestions.map((s, i) => ({
          name: s.name,
          description: s.description,
          weight: s.weight,
          max_score: s.max_score,
          order: i + 1,
        })),
      );
      setAiStatus(`✨ AI suggested ${suggestions.length} criteria — review and save below`);
    } catch (e: any) {
      setError(extractApiError(e, 'AI generation failed'));
    } finally {
      setAiGenerating(false);
    }
  }

  function updateRow(i: number, field: string, val: string | number) {
    setNewCriteria((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)),
    );
  }

  function addRow() {
    setNewCriteria((prev) => [
      ...prev,
      { name: '', description: '', weight: 25, max_score: 10, order: prev.length + 1 },
    ]);
  }

  function removeRow(i: number) {
    setNewCriteria((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Evaluation Criteria — {hackathon.title}</h2>

        {isLoading && <p className={styles.loading}>Loading…</p>}

        {criteria && criteria.length > 0 && (
          <div className={styles.criteriaList}>
            <p className={styles.label}>Existing criteria:</p>
            {criteria.map((c: EvaluationCriteria) => (
              <div key={c.id} className={styles.criteriaRow}>
                <span className={styles.criteriaName}>{c.name}</span>
                <span className={styles.criteriaWeight}>weight {c.weight}%</span>
                <span className={styles.criteriaMax}>max {c.max_score}pts</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.criteriaAiBar}>
          <p className={styles.label} style={{ margin: 0 }}>Add new criteria:</p>
          <button
            type="button"
            className={styles.aiBtn}
            disabled={aiGenerating}
            onClick={handleGenerateWithAI}
          >
            {aiGenerating ? '⏳ Generating…' : '✨ Generate with AI'}
          </button>
        </div>
        {aiStatus && <p className={styles.aiStatus}>{aiStatus}</p>}
        {newCriteria.map((row, i) => (
          <div key={i} className={styles.newCriteriaRow}>
            <input
              className={styles.input}
              placeholder="Criterion name"
              value={row.name}
              onChange={(e) => updateRow(i, 'name', e.target.value)}
            />
            <input
              className={styles.input}
              placeholder="Description (optional)"
              value={row.description}
              onChange={(e) => updateRow(i, 'description', e.target.value)}
            />
            <input
              type="number"
              className={styles.inputXs}
              min={1}
              max={100}
              value={row.weight}
              title="Weight %"
              onChange={(e) => updateRow(i, 'weight', Number(e.target.value))}
            />
            <span className={styles.fieldLabel}>wt%</span>
            <input
              type="number"
              className={styles.inputXs}
              min={1}
              max={100}
              value={row.max_score}
              title="Max score"
              onChange={(e) => updateRow(i, 'max_score', Number(e.target.value))}
            />
            <span className={styles.fieldLabel}>max</span>
            {newCriteria.length > 1 && (
              <button type="button" className={styles.removeBtn} onClick={() => removeRow(i)}>×</button>
            )}
          </div>
        ))}

        <button type="button" className={styles.ghostBtn} onClick={addRow}>+ Add row</button>

        {error && <p className={styles.error}>{error}</p>}
        {saved && <p className={styles.success}>Criteria saved!</p>}

        <div className={styles.modalActions}>
          <button
            className={styles.primaryBtn}
            disabled={!newCriteria.some((c) => c.name.trim()) || addCriteria.isPending}
            onClick={() => addCriteria.mutate()}
          >
            {addCriteria.isPending ? 'Saving…' : 'Save Criteria'}
          </button>
          <button className={styles.ghostBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
