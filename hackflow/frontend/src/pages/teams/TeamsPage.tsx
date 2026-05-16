import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { teamsApi } from '@/api/teams';
import { hackathonsApi } from '@/api/hackathons';
import { useAuthStore } from '@/store/authStore';
import { extractApiError } from '@/utils/apiError';
import type { Team, Hackathon } from '@/types';
import PageHero, { HeroAccent } from '@/components/ui/PageHero';
import styles from './TeamsPage.module.css';

function isTokenExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function CopyButton({ value, label = 'Copy', baseClass, copiedClass }: { value: string; label?: string; baseClass?: string; copiedClass?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      className={copied ? `${baseClass} ${copiedClass}` : baseClass}
      onClick={handleCopy}
    >
      {copied ? '[ OK ]' : label}
    </button>
  );
}

export default function TeamsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joinTeamId, setJoinTeamId] = useState('');
  const [joinError, setJoinError] = useState('');

  const { data: myTeams, isLoading } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => teamsApi.getMyTeams().then((r) => r.data),
  });

  const { data: hackathons } = useQuery({
    queryKey: ['hackathons', 'active'],
    queryFn: () => hackathonsApi.list({ status: 'active' }).then((r) => r.data),
  });

  const leaveTeam = useMutation({
    mutationFn: (teamId: string) => teamsApi.leave(teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-teams'] }),
  });

  const regenerateInvite = useMutation({
    mutationFn: (teamId: string) => teamsApi.regenerateInvite(teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-teams'] }),
  });

  const joinTeam = useMutation({
    mutationFn: () => teamsApi.joinByToken(joinTeamId, joinToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-teams'] });
      setJoinToken('');
      setJoinTeamId('');
      setJoinError('');
    },
    onError: (err: any) => {
      setJoinError(extractApiError(err, 'Failed to join team'));
    },
  });

  const hackathonMap = React.useMemo(() => {
    const map: Record<string, Hackathon> = {};
    hackathons?.forEach((h) => { map[h.id] = h; });
    return map;
  }, [hackathons]);

  const teamCount = myTeams?.length ?? 0;

  return (
    <div className={styles.root}>
      <PageHero
        eyebrow={teamCount > 0 ? `${teamCount} team${teamCount === 1 ? '' : 's'} active` : 'Build with friends'}
        title={<>Your <HeroAccent>squad</HeroAccent>, your hackathon.</>}
        subtitle="Create a team, ship a project together, or jump into someone else's crew with an invite token."
        actions={
          <button className={styles.primaryBtn} onClick={() => setShowCreate(true)}>
            $ mkdir --team
          </button>
        }
      />

      {/* Join by invite token */}
      <section className={styles.joinSection}>
        <h2 className={styles.sectionTitle}>// join_team</h2>
        <div className={styles.joinForm}>
          <input
            className={styles.input}
            placeholder="Team ID"
            value={joinTeamId}
            onChange={(e) => setJoinTeamId(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Invite token"
            value={joinToken}
            onChange={(e) => setJoinToken(e.target.value)}
          />
          <button
            className={styles.primaryBtn}
            disabled={!joinToken.trim() || !joinTeamId.trim() || joinTeam.isPending}
            onClick={() => joinTeam.mutate()}
          >
            Join
          </button>
        </div>
        {joinError && (
          <div className={styles.alertError}>
            <span className={styles.alertIcon}>[ERR]</span>
            <span>{joinError}</span>
          </div>
        )}
      </section>

      {/* My teams list */}
      <section className={styles.section}>
        {isLoading && <p className={styles.loading}>$ ls teams/…</p>}
        {!isLoading && !myTeams?.length && (
          <div className={styles.empty}>
            <p>// no teams found</p>
            <p className={styles.emptyHint}>$ mkdir --team or join with invite token</p>
          </div>
        )}

        <div className={styles.grid}>
          {myTeams?.map((team) => {
            const hackathon = hackathonMap[team.hackathon_id];
            const isLeader = team.leader_id === user?.id;
            return (
              <div key={team.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h3 className={styles.teamName}>{team.name}</h3>
                    {hackathon && (
                      <p className={styles.hackathonName}>{hackathon.title}</p>
                    )}
                  </div>
                  <span className={`${styles.statusBadge} ${styles[team.status]}`}>
                    {team.status}
                  </span>
                </div>

                {team.description && (
                  <p className={styles.desc}>{team.description}</p>
                )}

                <div className={styles.members}>
                  {team.members.slice(0, 5).map((m) => (
                    <div key={m.user_id} className={styles.memberChip} title={m.username}>
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt={m.username} className={styles.avatar} />
                        : <span className={styles.avatarFallback}>{m.username[0].toUpperCase()}</span>
                      }
                    </div>
                  ))}
                  {team.members.length > 5 && (
                    <span className={styles.moreMembers}>+{team.members.length - 5}</span>
                  )}
                  <span className={styles.memberCount}>
                    {team.size} member{team.size !== 1 ? 's' : ''}
                  </span>
                </div>

                {isLeader && (
                  <div className={styles.inviteBlock}>
                    <div className={styles.inviteRow}>
                      <span className={styles.inviteLabel}>// team_id</span>
                      <code className={styles.inviteToken}>{team.id}</code>
                      <CopyButton value={team.id} label="Copy" baseClass={styles.copyBtn} copiedClass={styles.copyBtnCopied} />
                    </div>
                    {team.invite_token && (
                      <div className={styles.inviteRow}>
                        <span className={styles.inviteLabel}>// invite_token</span>
                        {isTokenExpired(team.invite_token_expires_at)
                          ? <span className={styles.tokenExpired}>[EXPIRED]</span>
                          : <code className={styles.inviteToken}>{team.invite_token.slice(0, 16)}…</code>
                        }
                        {!isTokenExpired(team.invite_token_expires_at) && (
                          <CopyButton value={team.invite_token} label="Copy" baseClass={styles.copyBtn} copiedClass={styles.copyBtnCopied} />
                        )}
                        <button
                          className={styles.copyBtn}
                          onClick={() => regenerateInvite.mutate(team.id)}
                          disabled={regenerateInvite.isPending}
                        >
                          {regenerateInvite.isPending ? '…' : '$ regen'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {team.discord_guild_id && team.discord_text_channel_id && (
                  <div className={styles.discordLinks}>
                    <a
                      href={`https://discord.com/channels/${team.discord_guild_id}/${team.discord_text_channel_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.discordLink}
                    >
                      [irc] #text
                    </a>
                    {team.discord_voice_channel_id && (
                      <a
                        href={`https://discord.com/channels/${team.discord_guild_id}/${team.discord_voice_channel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.discordLink}
                      >
                        [voice] connect
                      </a>
                    )}
                  </div>
                )}

                <div className={styles.cardActions}>
                  <Link to={`/workspace/${team.id}`} className={styles.actionBtn}>
                    $ cd workspace/
                  </Link>
                  {team.hackathon_id && (
                    <Link
                      to={`/teams/${team.id}/matchmaking`}
                      className={styles.actionBtnSecondary}
                    >
                      $ find --members
                    </Link>
                  )}
                  {!isLeader && (
                    <button
                      className={styles.dangerBtn}
                      onClick={() => leaveTeam.mutate(team.id)}
                    >
                      $ exit --team
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {showCreate && (
        <CreateTeamModal
          hackathons={hackathons ?? []}
          onClose={() => setShowCreate(false)}
          onCreated={(team) => {
            qc.invalidateQueries({ queryKey: ['my-teams'] });
            setShowCreate(false);
            navigate(`/workspace/${team.id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateTeamModal({
  hackathons,
  onClose,
  onCreated,
}: {
  hackathons: Hackathon[];
  onClose: () => void;
  onCreated: (team: Team) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    hackathon_id: hackathons[0]?.id ?? '',
  });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: () => teamsApi.create(form),
    onSuccess: (res) => onCreated(res.data),
    onError: (err: any) => {
      setError(extractApiError(err, 'Failed to create team'));
    },
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>// create_team</h2>

        <label className={styles.label}>Hackathon</label>
        <select
          className={styles.select}
          value={form.hackathon_id}
          onChange={(e) => setForm((f) => ({ ...f, hackathon_id: e.target.value }))}
        >
          {hackathons.map((h) => (
            <option key={h.id} value={h.id}>{h.title}</option>
          ))}
        </select>

        <label className={styles.label}>Team Name</label>
        <input
          className={styles.input}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Team Alpha"
        />

        <label className={styles.label}>Description (optional)</label>
        <textarea
          className={styles.textarea}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="What are you building?"
          rows={3}
        />

        {error && (
          <div className={styles.alertError}>
            <span className={styles.alertIcon}>[ERR]</span>
            <span>{error}</span>
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.primaryBtn} onClick={() => create.mutate()} disabled={!form.name.trim() || !form.hackathon_id || create.isPending}>
            {create.isPending ? '$ mkdir...' : '$ mkdir --team'}
          </button>
          <button className={styles.ghostBtn} onClick={onClose}>abort</button>
        </div>
      </div>
    </div>
  );
}
