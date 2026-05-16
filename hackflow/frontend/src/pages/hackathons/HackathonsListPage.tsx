import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hackathonsApi } from '@/api/hackathons';
import type { Hackathon, HackathonStatus } from '@/types';
import styles from './HackathonsListPage.module.css';

type FilterValue = 'all' | HackathonStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Past' },
];

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sFmt = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const eFmt = e.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
  return `${sFmt} – ${eFmt}${sameYear ? `, ${s.getFullYear()}` : ''}`;
}

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function statusClass(status: HackathonStatus) {
  switch (status) {
    case 'active': return styles.statusActive;
    case 'upcoming': return styles.statusUpcoming;
    case 'completed': return styles.statusCompleted;
    case 'cancelled': return styles.statusCancelled;
    default: return styles.statusDraft;
  }
}

function HackathonCard({ h }: { h: Hackathon }) {
  return (
    <Link to={`/hackathons/${h.id}`} className={styles.card}>
      <div className={styles.cardMedia}>
        {h.banner_url ? (
          <>
            <img src={h.banner_url} alt={h.title} className={styles.cardMediaImg} />
            <div className={styles.cardOverlay} />
          </>
        ) : (
          <>
            <div className={styles.cardMediaPattern} />
            <div className={styles.cardMediaInitials}>{getInitials(h.title)}</div>
            <div className={styles.cardOverlay} />
          </>
        )}
        <span className={styles.cardDateBadge}>
          {formatDateRange(h.start_date, h.end_date)}
        </span>
        <span className={`${styles.cardStatusBadge} ${statusClass(h.status)}`}>
          {h.status}
        </span>
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{h.title}</h3>
        {h.description && (
          <p className={styles.cardDesc}>{h.description}</p>
        )}
        {h.tags?.length > 0 && (
          <div className={styles.cardTags}>
            {h.tags.slice(0, 4).map((t) => (
              <span key={t.name} className={styles.cardTag}>{t.name}</span>
            ))}
          </div>
        )}
        <div className={styles.cardFoot}>
          <span>{h.min_team_size}–{h.max_team_size} per team</span>
          <span className={styles.cardFootCta}>
            $ cat details →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function HackathonsListPage() {
  const [filter, setFilter] = useState<FilterValue>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['hackathons'],
    queryFn: () => hackathonsApi.list().then((r) => r.data as Hackathon[]),
  });

  const counts = useMemo(() => {
    const c: Record<FilterValue, number> = {
      all: 0, active: 0, upcoming: 0, completed: 0,
      draft: 0, cancelled: 0,
    } as Record<FilterValue, number>;
    (data ?? []).forEach((h) => {
      c.all += 1;
      c[h.status] = (c[h.status] ?? 0) + 1;
    });
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (filter === 'all') return list;
    return list.filter((h) => h.status === filter);
  }, [data, filter]);

  const featured = useMemo(
    () => (data ?? []).filter((h) => h.status === 'active' || h.status === 'upcoming'),
    [data],
  );
  const past = useMemo(
    () => (data ?? []).filter((h) => h.status === 'completed' || h.status === 'cancelled'),
    [data],
  );

  const totalParticipants = useMemo(() => {
    return (data ?? []).reduce((s, h) => s + (h.max_participants ?? 0), 0);
  }, [data]);

  return (
    <div className={styles.root}>
      {/* Hero */}
      <section className={styles.hero}>
        <span className={styles.heroEyebrow}>
          <span className={styles.heroPulse} />
          {counts.active > 0 ? `[${counts.active}] hackathons live now` : '$ hackflow --platform'}
        </span>
        <h1 className={styles.heroTitle}>
          Build, ship and{' '}
          <span className={styles.heroTitleAccent}>win</span>
          <br />$ ./hackathon --enter
        </h1>
        <p className={styles.heroSubtitle}>
          // hackflow runtime · developers + mentors + judges · fast-paced innovation
          events · find a challenge worth your weekend
        </p>
        <div className={styles.heroActions}>
          <a href="#hackathons" className={styles.btnPrimary}>
            $ ls hackathons/ ↓
          </a>
          <Link to="/teams" className={styles.btnGhost}>
            $ find --team
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{counts.all}</div>
          <div className={styles.statLabel}>total_hackathons</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{counts.active + counts.upcoming}</div>
          <div className={styles.statLabel}>open_to_join</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{counts.completed}</div>
          <div className={styles.statLabel}>completed</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>
            {totalParticipants > 0 ? `${totalParticipants}+` : '∞'}
          </div>
          <div className={styles.statLabel}>hacker_seats</div>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className={styles.section} id="hackathons">
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>// Featured</span>
            <h2 className={styles.sectionTitle}>
              process <span className={styles.sectionTitleAccent}>status=active</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              // live and upcoming hackathons accepting registrations · pick a challenge · assemble team · ship
            </p>
          </div>
          <div className={styles.grid}>
            {featured.map((h) => <HackathonCard key={h.id} h={h} />)}
          </div>
        </section>
      )}

      {/* All hackathons with filters */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>// Browse</span>
          <h2 className={styles.sectionTitle}>
            ls <span className={styles.sectionTitleAccent}>hackathons/</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            // filter by status · join open events or browse the archive
          </p>
        </div>

        <div className={styles.filters} role="tablist" aria-label="Filter hackathons">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              className={`${styles.filterBtn} ${filter === f.value ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className={styles.filterCount}>{counts[f.value] ?? 0}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className={styles.loadingGrid}>
            {[0, 1, 2].map((i) => <div key={i} className={styles.skeleton} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Nothing here yet</p>
            <p>No hackathons match this filter — try another category.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((h) => <HackathonCard key={h.id} h={h} />)}
          </div>
        )}
      </section>

      {/* Archive */}
      {past.length > 0 && filter === 'all' && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>// Archive</span>
            <h2 className={styles.sectionTitle}>
              Previous <span className={styles.sectionTitleAccent}>hackathons</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              Look back at completed events, browse winning teams and review what was built.
            </p>
          </div>
          <div className={`${styles.grid} ${styles.archiveGrid}`}>
            {past.map((h) => <HackathonCard key={h.id} h={h} />)}
          </div>
        </section>
      )}
    </div>
  );
}
