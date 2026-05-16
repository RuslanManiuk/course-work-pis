import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { usersApi, type UpdateProfilePayload } from '@/api/users';
import { extractApiError } from '@/utils/apiError';
import styles from './ProfilePage.module.css';

const PROFICIENCY_OPTIONS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

export default function ProfilePage() {
  const { setUser } = useAuthStore();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => usersApi.getMe().then((r) => r.data),
  });

  const profile = me?.profile;

  const [bio, setBio] = useState('');
  const [yearsExp, setYearsExp] = useState(0);
  const [skills, setSkills] = useState<UpdateProfilePayload['skills']>([]);
  const [techStack, setTechStack] = useState<UpdateProfilePayload['tech_stack']>([]);
  const [mentoringExpertise, setMentoringExpertise] = useState<string[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillProf, setNewSkillProf] = useState<typeof PROFICIENCY_OPTIONS[number]>('intermediate');
  const [newTech, setNewTech] = useState('');
  const [newTechYears, setNewTechYears] = useState(1);
  const [newExpertise, setNewExpertise] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (me && !initialized) {
    setBio(profile?.bio ?? '');
    setYearsExp(profile?.years_experience ?? 0);
    setSkills(profile?.skills ?? []);
    setTechStack(profile?.tech_stack ?? []);
    setMentoringExpertise((profile?.mentoring_expertise as string[]) ?? []);
    setInitialized(true);
  }

  const save = useMutation({
    mutationFn: () =>
      usersApi.updateProfile({
        bio: bio.trim() || undefined,
        skills: skills?.length ? skills : undefined,
        tech_stack: techStack?.length ? techStack : undefined,
        years_experience: yearsExp || undefined,
        mentoring_expertise: mentoringExpertise.length ? mentoringExpertise : undefined,
      }),
    onSuccess: (res) => {
      setSaved(true);
      setError('');
      qc.invalidateQueries({ queryKey: ['me'] });
      setUser(res.data);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: any) => {
      setError(extractApiError(e, 'Failed to save profile'));
    },
  });

  function addSkill() {
    if (!newSkillName.trim()) return;
    setSkills((prev) => [...(prev ?? []), { name: newSkillName.trim(), proficiency: newSkillProf }]);
    setNewSkillName('');
  }

  function removeSkill(i: number) {
    setSkills((prev) => prev?.filter((_, idx) => idx !== i));
  }

  function addTech() {
    if (!newTech.trim()) return;
    setTechStack((prev) => [...(prev ?? []), { tech: newTech.trim(), years: newTechYears }]);
    setNewTech('');
    setNewTechYears(1);
  }

  function removeTech(i: number) {
    setTechStack((prev) => prev?.filter((_, idx) => idx !== i));
  }

  function addExpertise() {
    if (!newExpertise.trim()) return;
    setMentoringExpertise((prev) => [...prev, newExpertise.trim()]);
    setNewExpertise('');
  }

  function removeExpertise(i: number) {
    setMentoringExpertise((prev) => prev.filter((_, idx) => idx !== i));
  }

  if (isLoading) return <p className={styles.loading}>$ cat profile.json…</p>;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.avatar}>
          {me?.avatar_url
            ? <img src={me.avatar_url} alt={me.username} />
            : <span>{me?.username?.[0]?.toUpperCase() ?? '?'}</span>
          }
        </div>
        <div className={styles.identity}>
          <h1 className={styles.username}>{me?.username}</h1>
          <span className={styles.email}>{me?.email}</span>
          <span className={styles.roleBadge}>{me?.role}</span>
          {me?.github_username && (
            <a
              href={`https://github.com/${me.github_username}`}
              target="_blank"
              rel="noreferrer"
              className={styles.githubLink}
            >
              GitHub: {me.github_username}
            </a>
          )}
        </div>
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {/* ── Bio ──────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>// about</h2>
          <label className={styles.label}>// bio</label>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="echo 'tell others about yourself'…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />

          <label className={styles.label}>// years_experience</label>
          <input
            type="number"
            className={styles.input}
            min={0}
            max={50}
            value={yearsExp}
            onChange={(e) => setYearsExp(Number(e.target.value))}
          />
        </section>

        {/* ── Skills ───────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>// skills</h2>

          <div className={styles.chips}>
            {skills?.map((s, i) => (
              <span key={i} className={`${styles.chip} ${styles[`prof_${s.proficiency}`]}`}>
                {s.name}
                <em>{s.proficiency}</em>
                <button type="button" className={styles.chipRemove} onClick={() => removeSkill(i)}>×</button>
              </span>
            ))}
          </div>

          <div className={styles.addRow}>
            <input
              className={styles.inputSm}
              placeholder="Skill name (e.g. Python)"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            />
            <select
              className={styles.selectSm}
              value={newSkillProf}
              onChange={(e) => setNewSkillProf(e.target.value as any)}
            >
              {PROFICIENCY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button type="button" className={styles.addBtn} onClick={addSkill}>push</button>
          </div>
        </section>

        {/* ── Tech Stack ───────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>// tech_stack</h2>

          <div className={styles.chips}>
            {techStack?.map((t, i) => (
              <span key={i} className={styles.chip}>
                {t.tech}
                <em>{t.years}y</em>
                <button type="button" className={styles.chipRemove} onClick={() => removeTech(i)}>×</button>
              </span>
            ))}
          </div>

          <div className={styles.addRow}>
            <input
              className={styles.inputSm}
              placeholder="Technology (e.g. React)"
              value={newTech}
              onChange={(e) => setNewTech(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())}
            />
            <input
              type="number"
              className={styles.inputXs}
              min={0}
              max={30}
              value={newTechYears}
              onChange={(e) => setNewTechYears(Number(e.target.value))}
              title="Years of experience"
            />
            <span className={styles.yearsLabel}>yrs</span>
            <button type="button" className={styles.addBtn} onClick={addTech}>push</button>
          </div>
        </section>

        {/* ── Mentoring Expertise (mentors only) ───────────────────── */}
        {(me?.role === 'mentor' || me?.role === 'organizer') && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>// mentoring_expertise</h2>

            <div className={styles.chips}>
              {mentoringExpertise.map((e, i) => (
                <span key={i} className={`${styles.chip} ${styles.chipMentor}`}>
                  {e}
                  <button type="button" className={styles.chipRemove} onClick={() => removeExpertise(i)}>×</button>
                </span>
              ))}
            </div>

            <div className={styles.addRow}>
              <input
                className={styles.inputSm}
                placeholder="Area of expertise (e.g. ML, DevOps)"
                value={newExpertise}
                onChange={(e) => setNewExpertise(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertise())}
              />
              <button type="button" className={styles.addBtn} onClick={addExpertise}>push</button>
            </div>
          </section>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {saved && <p className={styles.success}>[ OK ] profile saved</p>}

        <div className={styles.actions}>
          <button type="submit" className={styles.saveBtn} disabled={save.isPending}>
            {save.isPending ? '$ updating...' : '$ write --profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
