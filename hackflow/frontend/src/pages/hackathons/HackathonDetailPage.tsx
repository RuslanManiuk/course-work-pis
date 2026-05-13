import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hackathonsApi } from '@/api/hackathons';
import { teamsApi } from '@/api/teams';
import { useAuthStore } from '@/store/authStore';
import WinnersPodium from '@/components/hackathon/WinnersPodium';
import WinnersAdmin from '@/components/hackathon/WinnersAdmin';
import styles from './HackathonDetailPage.module.css';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  return days;
}

export default function HackathonDetailPage() {
  const { hackathonId } = useParams<{ hackathonId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: hackathon, isLoading, error } = useQuery({
    queryKey: ['hackathon', hackathonId],
    queryFn: () => hackathonsApi.get(hackathonId!).then((r) => r.data),
    enabled: !!hackathonId,
  });

  const { data: criteria } = useQuery({
    queryKey: ['hackathon-criteria', hackathonId],
    queryFn: () => hackathonsApi.getCriteria(hackathonId!).then((r) => r.data),
    enabled: !!hackathonId,
  });

  const { data: myTeams } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => teamsApi.getMyTeams().then((r) => r.data),
    enabled: !!user,
  });

  const { data: winners } = useQuery({
    queryKey: ['hackathon-winners', hackathonId],
    queryFn: () => hackathonsApi.listWinners(hackathonId!).then((r) => r.data),
    enabled: !!hackathonId,
  });

  const myTeamForHackathon = myTeams?.find((t) => t.hackathon_id === hackathonId);
  const isOwner = user?.role === 'organizer' && hackathon?.organizer_id === user?.id;

  if (isLoading) {
    return <div className={styles.loading}>Loading hackathon…</div>;
  }
  if (error || !hackathon) {
    return <div className={styles.error}>Hackathon not found.</div>;
  }

  const registrationDays = daysUntil(hackathon.registration_deadline);
  const submissionDays = daysUntil(hackathon.submission_deadline);
  const isRegistrationOpen = hackathon.status === 'upcoming' || hackathon.status === 'active';

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        {hackathon.banner_url && (
          <div className={styles.heroBanner}>
            <img src={hackathon.banner_url} alt={hackathon.title} />
          </div>
        )}
        <div className={styles.heroContent}>
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{hackathon.title}</h1>
              <span className={`${styles.statusBadge} ${styles[hackathon.status]}`}>
                {hackathon.status}
              </span>
            </div>
            {hackathon.tags.length > 0 && (
              <div className={styles.tags}>
                {hackathon.tags.map((tag) => (
                  <span key={tag.name} className={styles.tag}>{tag.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Winners podium — shown above the fold when winners exist */}
      {winners && winners.length > 0 && <WinnersPodium winners={winners} />}

      <div className={styles.layout}>
        {/* Main content */}
        <div className={styles.main}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>About</h2>
            <p className={styles.description}>{hackathon.description}</p>
          </section>

          {/* Organizer-only: manage winners */}
          {isOwner && (
            <WinnersAdmin
              hackathonId={hackathon.id}
              winners={winners ?? []}
            />
          )}

          {criteria && criteria.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Evaluation Criteria</h2>
              <div className={styles.criteriaList}>
                {criteria.map((c) => (
                  <div key={c.id} className={styles.criteriaCard}>
                    <div className={styles.criteriaHeader}>
                      <span className={styles.criteriaName}>{c.name}</span>
                      <span className={styles.criteriaWeight}>{c.weight}% · max {c.max_score}pts</span>
                    </div>
                    {c.description && (
                      <p className={styles.criteriaDesc}>{c.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <h3 className={styles.sideCardTitle}>Key Dates</h3>
            <div className={styles.dateList}>
              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>Starts</span>
                <span className={styles.dateValue}>{formatDate(hackathon.start_date)}</span>
              </div>
              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>Ends</span>
                <span className={styles.dateValue}>{formatDate(hackathon.end_date)}</span>
              </div>
              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>Registration</span>
                <span className={styles.dateValue}>
                  {formatDate(hackathon.registration_deadline)}
                  {registrationDays > 0 && (
                    <em className={styles.daysLeft}> · {registrationDays}d left</em>
                  )}
                </span>
              </div>
              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>Submission</span>
                <span className={styles.dateValue}>
                  {formatDate(hackathon.submission_deadline)}
                  {submissionDays > 0 && (
                    <em className={styles.daysLeft}> · {submissionDays}d left</em>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.sideCard}>
            <h3 className={styles.sideCardTitle}>Team Info</h3>
            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Team size</span>
                <span className={styles.infoValue}>
                  {hackathon.min_team_size}–{hackathon.max_team_size} members
                </span>
              </div>
              {hackathon.max_participants && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Max participants</span>
                  <span className={styles.infoValue}>{hackathon.max_participants}</span>
                </div>
              )}
            </div>
          </div>

          {myTeamForHackathon ? (
            <div className={styles.myTeamCard}>
              <p className={styles.myTeamLabel}>Your team</p>
              <p className={styles.myTeamName}>{myTeamForHackathon.name}</p>
              <Link to={`/workspace/${myTeamForHackathon.id}`} className={styles.primaryBtn}>
                Open Workspace
              </Link>
            </div>
          ) : (
            isRegistrationOpen && (
              <button
                className={styles.primaryBtn}
                onClick={() => navigate(`/teams?hackathon=${hackathonId}`)}
              >
                Join / Create Team
              </button>
            )
          )}

          {user?.role === 'judge' && hackathon.status === 'active' && (
            <Link to={`/judging/${hackathonId}`} className={styles.secondaryBtn}>
              Go to Judging Panel
            </Link>
          )}

          {user?.role === 'organizer' && (
            <Link to={`/admin`} className={styles.ghostBtn}>
              Manage in Admin Panel
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
