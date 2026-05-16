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
        eyebrow={activeCount > 0 ? `[${activeCount}] hackathon${activeCount === 1 ? '' : 's'} awaiting eval` : '$ judging --panel'}
        title={<>$ score <HeroAccent>--submissions</HeroAccent></>}
        subtitle="// review submissions · evaluate against criteria · rank teams by score"
      />

      {isLoading && <p className={styles.loading}>$ ls hackathons/…</p>}

      {!isLoading && !data?.length && (
        <div className={styles.empty}>
          <p>// no hackathons available for judging</p>
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
              $ open --judging-panel →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
