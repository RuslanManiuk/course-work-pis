import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hackathonsApi } from '@/api/hackathons';
import type { Hackathon } from '@/types';
import PageHero, { HeroAccent } from '@/components/ui/PageHero';
import styles from './JudgingLandingPage.module.css';

export default function JudgingLandingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['hackathons'],
    queryFn: () => hackathonsApi.list().then((r) => r.data as Hackathon[]),
  });

  const activeCount = (data ?? []).filter((h) => h.status === 'active').length;

  return (
    <div className={styles.root}>
      <PageHero
        eyebrow={activeCount > 0 ? `${activeCount} hackathon${activeCount === 1 ? '' : 's'} ready to judge` : 'Judging panel'}
        title={<>Pick a hackathon, <HeroAccent>score the work</HeroAccent>.</>}
        subtitle="Review submissions, evaluate against criteria and crown the teams that built the best solution."
      />

      {isLoading && <p className={styles.loading}>Loading hackathons…</p>}

      {!isLoading && !data?.length && (
        <div className={styles.empty}>
          <p>No hackathons available for judging.</p>
        </div>
      )}

      <div className={styles.grid}>
        {data?.map((h) => (
          <Link key={h.id} to={`/judging/${h.id}`} className={styles.card}>
            <span className={styles.cardEyebrow}>// Hackathon</span>
            <h3 className={styles.cardTitle}>{h.title}</h3>
            <p className={styles.cardMeta}>
              {h.status} · ends {new Date(h.end_date).toLocaleDateString()}
            </p>
            {h.tags?.length > 0 && (
              <div className={styles.tags}>
                {h.tags.slice(0, 4).map((t) => (
                  <span key={t.name} className={styles.tag}>{t.name}</span>
                ))}
              </div>
            )}
            <span className={styles.cta}>
              Open judging panel <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
