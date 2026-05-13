import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/api/teams';
import { hackathonsApi } from '@/api/hackathons';
import styles from './MatchmakingPage.module.css';

export default function MatchmakingPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: team } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamsApi.get(teamId!).then((r) => r.data),
    enabled: !!teamId,
  });

  const hackathonId = team?.hackathon_id;

  const { data: hackathon } = useQuery({
    queryKey: ['hackathon', hackathonId],
    queryFn: () => hackathonsApi.get(hackathonId!).then((r) => r.data),
    enabled: !!hackathonId,
  });

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['matchmaking', hackathonId],
    queryFn: () => teamsApi.getMatchmaking(hackathonId!).then((r) => r.data),
    enabled: !!hackathonId,
  });

  const joinTeam = useMutation({
    mutationFn: (suggestedTeamId: string) =>
      teamsApi.joinByToken(suggestedTeamId, ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-teams'] });
      navigate('/teams');
    },
  });

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/teams')}>
          ← Back to Teams
        </button>
        <div>
          <h1 className={styles.title}>Find Team Members</h1>
          {hackathon && (
            <p className={styles.subtitle}>{hackathon.title}</p>
          )}
        </div>
      </div>

      {team && (
        <div className={styles.myTeamCard}>
          <span className={styles.myTeamLabel}>Your team:</span>
          <span className={styles.myTeamName}>{team.name}</span>
          <span className={styles.myTeamSize}>{team.size} member{team.size !== 1 ? 's' : ''}</span>
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Teams Looking for Members</h2>
          <p className={styles.sectionHint}>
            Ranked by how many of your skills match their gaps
          </p>
        </div>

        {isLoading && <p className={styles.loading}>Finding matches…</p>}

        {!isLoading && !suggestions?.length && (
          <div className={styles.empty}>
            <p>No matching teams found.</p>
            <p className={styles.emptyHint}>
              Teams appear here when they're still forming and you have skills they need.
            </p>
          </div>
        )}

        <div className={styles.grid}>
          {suggestions?.map((s) => (
            <div key={s.team_id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.teamName}>{s.team_name}</h3>
                  {s.description && (
                    <p className={styles.teamDesc}>{s.description}</p>
                  )}
                </div>
                <div className={styles.scoreCircle}>
                  <span className={styles.scoreNum}>{Math.round(s.match_score * 100)}</span>
                  <span className={styles.scorePct}>%</span>
                </div>
              </div>

              <div className={styles.meta}>
                <span className={styles.metaItem}>
                  {s.current_size} member{s.current_size !== 1 ? 's' : ''}
                </span>
              </div>

              {s.skill_gap.length > 0 && (
                <div className={styles.skillGap}>
                  <p className={styles.skillGapLabel}>Your skills they need:</p>
                  <div className={styles.skills}>
                    {s.skill_gap.slice(0, 6).map((sk) => (
                      <span key={sk} className={styles.skillChip}>{sk}</span>
                    ))}
                    {s.skill_gap.length > 6 && (
                      <span className={styles.moreSkills}>+{s.skill_gap.length - 6} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
