import styles from './RepoStatsModal.module.css';

// ── Language colour map (GitHub colours) ───────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Vue: '#41b883',
  Ruby: '#701516',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  PHP: '#4F5D95',
  Scala: '#c22d40',
  Dart: '#00B4AB',
};
const langColor = (lang: string) => LANG_COLORS[lang] ?? '#6c63ff';

// ── Types ───────────────────────────────────────────────────────────────────
interface Contributor {
  login: string;
  avatar_url?: string;
  contributions: number;
  html_url?: string;
}

interface Commit {
  sha: string;
  message: string;
  author_name: string;
  author_avatar?: string;
  date?: string;
  url?: string;
}

interface LangEntry {
  language: string;
  bytes: number;
  percentage: number;
}

interface Release {
  tag: string;
  name: string;
  published_at?: string;
  url?: string;
  prerelease: boolean;
}

export interface RepoStats {
  full_name: string;
  html_url: string;
  description: string | null;
  stars: number;
  watchers: number;
  forks: number;
  open_issues: number;
  language: string | null;
  topics: string[];
  default_branch: string;
  license: string | null;
  commit_count: number;
  contributors_count: number;
  contributors: Contributor[];
  recent_commits: Commit[];
  languages_breakdown: LangEntry[];
  releases: Release[];
  last_pushed_at: string | null;
  created_at: string | null;
  size_kb: number;
  visibility: string;
}

interface Props {
  stats: RepoStats;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(date?: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtSize(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function timeAgo(date?: string | null) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function RepoStatsModal({ stats, onClose }: Props) {
  const statCards = [
    { icon: '⭐', label: 'Stars', value: stats.stars },
    { icon: '🍴', label: 'Forks', value: stats.forks },
    { icon: '👁', label: 'Watchers', value: stats.watchers },
    { icon: '🐛', label: 'Open Issues', value: stats.open_issues },
    { icon: '📝', label: 'Commits', value: stats.commit_count },
    { icon: '👥', label: 'Contributors', value: stats.contributors_count },
  ];

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.ghIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </span>
            <div>
              <a className={styles.repoName} href={stats.html_url} target="_blank" rel="noreferrer">
                {stats.full_name}
              </a>
              {stats.description && <p className={styles.repoDesc}>{stats.description}</p>}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Badges row */}
        <div className={styles.badges}>
          {stats.visibility === 'public' ? (
            <span className={`${styles.badge} ${styles.badgePublic}`}>🔓 Public</span>
          ) : (
            <span className={`${styles.badge} ${styles.badgePrivate}`}>🔒 Private</span>
          )}
          {stats.language && (
            <span className={styles.badge} style={{ borderColor: langColor(stats.language), color: langColor(stats.language) }}>
              <span className={styles.langDot} style={{ background: langColor(stats.language) }} />
              {stats.language}
            </span>
          )}
          {stats.default_branch && (
            <span className={`${styles.badge} ${styles.badgeBranch}`}>🌿 {stats.default_branch}</span>
          )}
          {stats.license && (
            <span className={`${styles.badge} ${styles.badgeLicense}`}>⚖ {stats.license}</span>
          )}
        </div>

        {/* Stat cards */}
        <div className={styles.statGrid}>
          {statCards.map((s) => (
            <div key={s.label} className={styles.statCard}>
              <span className={styles.statIcon}>{s.icon}</span>
              <span className={styles.statValue}>{s.value.toLocaleString()}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.columns}>
          {/* Left column */}
          <div className={styles.col}>

            {/* Languages breakdown */}
            {stats.languages_breakdown.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Languages</h3>
                <div className={styles.langBar}>
                  {stats.languages_breakdown.map((l) => (
                    <div
                      key={l.language}
                      className={styles.langBarSegment}
                      style={{ width: `${l.percentage}%`, background: langColor(l.language) }}
                      title={`${l.language}: ${l.percentage}%`}
                    />
                  ))}
                </div>
                <div className={styles.langList}>
                  {stats.languages_breakdown.map((l) => (
                    <div key={l.language} className={styles.langItem}>
                      <span className={styles.langDot} style={{ background: langColor(l.language) }} />
                      <span className={styles.langName}>{l.language}</span>
                      <span className={styles.langPct}>{l.percentage}%</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Topics */}
            {stats.topics.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Topics</h3>
                <div className={styles.topicList}>
                  {stats.topics.map((t) => (
                    <span key={t} className={styles.topic}>{t}</span>
                  ))}
                </div>
              </section>
            )}

            {/* Releases */}
            {stats.releases.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Releases</h3>
                <div className={styles.releaseList}>
                  {stats.releases.map((r) => (
                    <a key={r.tag} href={r.url ?? '#'} target="_blank" rel="noreferrer" className={styles.releaseItem}>
                      <span className={styles.releaseTag}>{r.tag}</span>
                      <span className={styles.releaseName}>{r.name}</span>
                      {r.prerelease && <span className={styles.prerelease}>pre</span>}
                      <span className={styles.releaseDate}>{fmt(r.published_at)}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Meta */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Repository Info</h3>
              <div className={styles.metaList}>
                <div className={styles.metaRow}><span>📅 Created</span><span>{fmt(stats.created_at)}</span></div>
                <div className={styles.metaRow}><span>🔄 Last Push</span><span>{fmt(stats.last_pushed_at)}</span></div>
                <div className={styles.metaRow}><span>💾 Size</span><span>{fmtSize(stats.size_kb)}</span></div>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className={styles.col}>

            {/* Contributors */}
            {stats.contributors.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Top Contributors</h3>
                <div className={styles.contribList}>
                  {stats.contributors.map((c) => (
                    <a key={c.login} href={c.html_url ?? '#'} target="_blank" rel="noreferrer" className={styles.contrib}>
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.login} className={styles.contribAvatar} />
                      ) : (
                        <div className={styles.contribAvatarFallback}>{c.login[0].toUpperCase()}</div>
                      )}
                      <div className={styles.contribInfo}>
                        <span className={styles.contribLogin}>{c.login}</span>
                        <span className={styles.contribCount}>{c.contributions} commits</span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Recent commits */}
            {stats.recent_commits.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Recent Commits</h3>
                <div className={styles.commitList}>
                  {stats.recent_commits.map((c) => (
                    <a key={c.sha} href={c.url ?? '#'} target="_blank" rel="noreferrer" className={styles.commit}>
                      {c.author_avatar ? (
                        <img src={c.author_avatar} alt={c.author_name} className={styles.commitAvatar} />
                      ) : (
                        <div className={styles.commitAvatarFallback}>{c.author_name[0]?.toUpperCase()}</div>
                      )}
                      <div className={styles.commitInfo}>
                        <span className={styles.commitMsg}>{c.message}</span>
                        <span className={styles.commitMeta}>
                          <code className={styles.commitSha}>{c.sha}</code>
                          &nbsp;·&nbsp;{c.author_name}&nbsp;·&nbsp;{timeAgo(c.date)}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <a href={stats.html_url} target="_blank" rel="noreferrer" className={styles.openGhBtn}>
            Open on GitHub ↗
          </a>
        </div>
      </div>
    </div>
  );
}
