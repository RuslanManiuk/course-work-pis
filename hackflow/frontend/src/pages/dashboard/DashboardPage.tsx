import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { hackathonsApi } from '@/api/hackathons';
import { teamsApi } from '@/api/teams';
import type { Team, Hackathon } from '@/types';
import styles from './DashboardPage.module.css';

function DeadlineBar({ label, deadline }: { label: string; deadline: string }) {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const diff = end - now;
  const days = Math.ceil(diff / 86_400_000);
  const hours = Math.ceil(diff / 3_600_000);

  // assume hackathon ~ 7 days; clamp 0-100
  const totalMs = 7 * 86_400_000;
  const pct = Math.max(0, Math.min(100, (diff / totalMs) * 100));
  const urgent = hours <= 24;
  const passed = diff <= 0;

  return (
    <div className={styles.deadlineBar}>
      <div className={styles.deadlineLabel}>
        <span>{label}</span>
        <span className={passed ? styles.deadlinePassed : urgent ? styles.deadlineUrgent : styles.deadlineOk}>
          {passed ? '[EXPIRED]' : days <= 1 ? `ttl:${hours}h` : `ttl:${days}d`}
        </span>
      </div>
      <div className={styles.progressTrack}>
        <div
          className={passed ? styles.progressBarPassed : urgent ? styles.progressBarUrgent : styles.progressBar}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TeamCard({ team, hackathon }: { team: Team; hackathon?: Hackathon }) {
  const discordUrl = team.discord_guild_id
    ? `https://discord.com/channels/${team.discord_guild_id}/${team.discord_text_channel_id}`
    : null;
  const voiceUrl = team.discord_guild_id && team.discord_voice_channel_id
    ? `https://discord.com/channels/${team.discord_guild_id}/${team.discord_voice_channel_id}`
    : null;

  return (
    <div className={styles.teamCard}>
      <div className={styles.teamCardTop}>
        <div>
          <h3 className={styles.teamName}>{team.name}</h3>
          {hackathon && <p className={styles.teamHackathon}>{hackathon.title}</p>}
        </div>
        <div className={styles.teamActions}>
          <Link to={`/workspace/${team.id}`} className={styles.workspaceBtn}>
            $ cd workspace/
          </Link>
        </div>
      </div>

      <div className={styles.teamMembers}>
        {team.members.slice(0, 6).map((m) => (
          <div key={m.user_id} className={styles.memberAvatar} title={m.username}>
            {m.avatar_url
              ? <img src={m.avatar_url} alt={m.username} />
              : <span>{m.username[0].toUpperCase()}</span>
            }
          </div>
        ))}
        {team.members.length > 6 && (
          <span className={styles.moreMembers}>+{team.members.length - 6}</span>
        )}
      </div>

      {hackathon && (
        <div className={styles.deadlines}>
          <DeadlineBar label="// submission_deadline" deadline={hackathon.submission_deadline} />
        </div>
      )}

      {(discordUrl || voiceUrl) && (
        <div className={styles.discordLinks}>
          {discordUrl && (
            <a href={discordUrl} target="_blank" rel="noreferrer" className={styles.discordBtn}>
              [irc] #team-chat
            </a>
          )}
          {voiceUrl && (
            <a href={voiceUrl} target="_blank" rel="noreferrer" className={styles.discordBtn}>
              [voice] connect
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: hackathons } = useQuery({
    queryKey: ['hackathons', 'active'],
    queryFn: () => hackathonsApi.list({ status: 'active' }).then((r) => r.data),
  });

  const { data: myTeams } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => teamsApi.getMyTeams().then((r) => r.data),
  });

  const hackathonMap = React.useMemo(() => {
    const map: Record<string, Hackathon> = {};
    hackathons?.forEach((h) => { map[h.id] = h; });
    return map;
  }, [hackathons]);

  const activeCount = hackathons?.length ?? 0;

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <span className={styles.heroEyebrow}>
          <span className={styles.heroPulse} />
          {`● HACKFLOW RUNTIME v2.5.0 · ${activeCount} proc active`}
        </span>
        <h1 className={styles.greeting}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.55em', display: 'block', marginBottom: 4 }}>$ whoami</span>
          <span className={styles.name}>{user?.username}</span>
        </h1>
        <p className={styles.subtitle}>
          {activeCount > 0
            ? `[PID:${activeCount}] hackathon process${activeCount === 1 ? '' : 'es'} running — check your teams and deadlines.`
            : 'No active processes. Browse hackathons to join one.'}
        </p>
      </section>

      {myTeams && myTeams.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionEyebrow}>// My teams</span>
              <h2 className={styles.sectionTitle}>active team processes</h2>
            </div>
            <Link to="/teams" className={styles.seeAll}>ls -la →</Link>
          </div>
          <div className={styles.teamsGrid}>
            {myTeams.map((team) => (
              <TeamCard key={team.id} team={team} hackathon={hackathonMap[team.hackathon_id]} />
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>// Hackathons</span>
            <h2 className={styles.sectionTitle}>live hackathons · accepting input</h2>
          </div>
          <Link to="/hackathons" className={styles.seeAll}>ls -la →</Link>
        </div>

        {!hackathons?.length && (
          <p className={styles.empty}>// no active processes</p>
        )}

        <div className={styles.grid}>
          {hackathons?.map((h) => (
            <Link key={h.id} to={`/hackathons/${h.id}`} className={styles.card}>
              <div className={styles.bannerWrap}>
                {h.banner_url && (
                  <img src={h.banner_url} alt={h.title} className={styles.banner} />
                )}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTags}>
                  {h.tags?.slice(0, 3).map((t) => (
                    <span key={t.name} className={styles.tag}>{t.name}</span>
                  ))}
                </div>
                <h3 className={styles.cardTitle}>{h.title}</h3>
                <p className={styles.cardDesc}>{h.description.slice(0, 120)}…</p>
                <div className={styles.cardMeta}>
                  <span>deadline: {new Date(h.end_date).toLocaleDateString()}</span>
                  <span className={styles.statusBadge}>{h.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
