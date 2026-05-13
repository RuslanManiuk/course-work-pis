import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi, type SearchResults } from '@/api/search';
import styles from './CommandPalette.module.css';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type ResultItem =
  | { kind: 'hackathon'; id: string; title: string; status: string; endDate: string }
  | { kind: 'team'; id: string; hackathonId: string; name: string; subtitle: string }
  | { kind: 'user'; id: string; username: string; role: string; avatarUrl: string | null }
  | { kind: 'nav'; id: string; label: string; path: string };

const NAV_ITEMS: ResultItem[] = [
  { kind: 'nav', id: 'nav-dashboard', label: 'Go to Dashboard', path: '/dashboard' },
  { kind: 'nav', id: 'nav-hackathons', label: 'Browse Hackathons', path: '/hackathons' },
  { kind: 'nav', id: 'nav-teams', label: 'My Teams', path: '/teams' },
  { kind: 'nav', id: 'nav-helpdesk', label: 'Help Desk', path: '/helpdesk' },
  { kind: 'nav', id: 'nav-judging', label: 'Judging', path: '/judging' },
  { kind: 'nav', id: 'nav-profile', label: 'My Profile', path: '/profile' },
];

function statusClass(s: string) {
  if (s === 'active') return styles.statusActive;
  if (s === 'upcoming') return styles.statusUpcoming;
  if (s === 'completed') return styles.statusCompleted;
  return styles.statusOther;
}

function getInitials(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Fetch
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    searchApi
      .query(debounced || '', 5)
      .then((r) => {
        if (!cancelled) setResults(r.data);
      })
      .catch(() => {
        if (!cancelled) setResults({ query: debounced, hackathons: [], teams: [], users: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Filter nav items by query
  const filteredNav = useMemo(() => {
    const q = debounced.toLowerCase();
    if (!q) return [];
    return NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(q));
  }, [debounced]);

  // Flatten everything into a single navigable array
  const flatItems = useMemo<ResultItem[]>(() => {
    const items: ResultItem[] = [];
    if (results) {
      for (const h of results.hackathons) {
        items.push({
          kind: 'hackathon',
          id: h.id,
          title: h.title,
          status: h.status,
          endDate: h.end_date,
        });
      }
      for (const t of results.teams) {
        items.push({
          kind: 'team',
          id: t.id,
          hackathonId: t.hackathon_id,
          name: t.name,
          subtitle: t.hackathon_title
            ? `${t.hackathon_title} · ${t.size} member${t.size === 1 ? '' : 's'}`
            : `${t.size} member${t.size === 1 ? '' : 's'}`,
        });
      }
      for (const u of results.users) {
        items.push({
          kind: 'user',
          id: u.id,
          username: u.username,
          role: u.role,
          avatarUrl: u.avatar_url,
        });
      }
    }
    items.push(...filteredNav);
    return items;
  }, [results, filteredNav]);

  // Reset activeIdx when items change
  useEffect(() => {
    if (activeIdx >= flatItems.length) setActiveIdx(0);
  }, [flatItems.length, activeIdx]);

  const onPick = useCallback(
    (item: ResultItem) => {
      onClose();
      switch (item.kind) {
        case 'hackathon':
          navigate(`/hackathons/${item.id}`);
          break;
        case 'team':
          navigate(`/workspace/${item.id}`);
          break;
        case 'user':
          // No public user route — skip (could route to profile if mine)
          break;
        case 'nav':
          navigate(item.path);
          break;
      }
    },
    [navigate, onClose],
  );

  // Keyboard nav
  const handleKey = (e: React.KeyboardEvent) => {
    if (flatItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[activeIdx];
      if (item) onPick(item);
    }
  };

  if (!open) return null;

  const hasAny = flatItems.length > 0;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search hackathons, teams, people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
          />
          <span className={styles.escHint}>esc</span>
        </div>

        <div className={styles.results}>
          {!hasAny && (
            <div className={styles.empty}>
              {debounced
                ? `No matches for "${debounced}"`
                : 'Start typing to search across the platform.'}
            </div>
          )}

          {results && results.hackathons.length > 0 && (
            <div>
              <div className={styles.groupLabel}>
                Hackathons
                <span className={styles.groupCount}>{results.hackathons.length}</span>
              </div>
              {results.hackathons.map((h) => {
                const item = flatItems.find((it) => it.kind === 'hackathon' && it.id === h.id);
                const idx = item ? flatItems.indexOf(item) : -1;
                return (
                  <button
                    key={h.id}
                    className={`${styles.item} ${idx === activeIdx ? styles.itemActive : ''}`}
                    onClick={() => item && onPick(item)}
                    onMouseEnter={() => idx >= 0 && setActiveIdx(idx)}
                  >
                    <span className={`${styles.itemIcon} ${styles.iconHackathon}`}>
                      {getInitials(h.title)}
                    </span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{h.title}</span>
                      <span className={styles.itemSub}>
                        Ends {new Date(h.end_date).toLocaleDateString()}
                      </span>
                    </span>
                    <span className={`${styles.statusBadge} ${statusClass(h.status)}`}>{h.status}</span>
                    <span className={styles.itemArrow}>↵</span>
                  </button>
                );
              })}
            </div>
          )}

          {results && results.teams.length > 0 && (
            <div>
              <div className={styles.groupLabel}>
                Teams
                <span className={styles.groupCount}>{results.teams.length}</span>
              </div>
              {results.teams.map((t) => {
                const item = flatItems.find((it) => it.kind === 'team' && it.id === t.id);
                const idx = item ? flatItems.indexOf(item) : -1;
                return (
                  <button
                    key={t.id}
                    className={`${styles.item} ${idx === activeIdx ? styles.itemActive : ''}`}
                    onClick={() => item && onPick(item)}
                    onMouseEnter={() => idx >= 0 && setActiveIdx(idx)}
                  >
                    <span className={`${styles.itemIcon} ${styles.iconTeam}`}>{getInitials(t.name)}</span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{t.name}</span>
                      <span className={styles.itemSub}>
                        {t.hackathon_title ?? 'Team'} · {t.size} member{t.size === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className={styles.itemArrow}>↵</span>
                  </button>
                );
              })}
            </div>
          )}

          {results && results.users.length > 0 && (
            <div>
              <div className={styles.groupLabel}>
                People
                <span className={styles.groupCount}>{results.users.length}</span>
              </div>
              {results.users.map((u) => {
                const item = flatItems.find((it) => it.kind === 'user' && it.id === u.id);
                const idx = item ? flatItems.indexOf(item) : -1;
                return (
                  <button
                    key={u.id}
                    className={`${styles.item} ${idx === activeIdx ? styles.itemActive : ''}`}
                    onClick={() => item && onPick(item)}
                    onMouseEnter={() => idx >= 0 && setActiveIdx(idx)}
                  >
                    <span className={`${styles.itemIcon} ${styles.iconUser}`}>{u.username[0]?.toUpperCase() ?? '?'}</span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{u.username}</span>
                      <span className={styles.itemSub}>{u.role}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredNav.length > 0 && (
            <div>
              <div className={styles.groupLabel}>Quick actions</div>
              {filteredNav.map((n) => {
                const idx = flatItems.indexOf(n);
                return (
                  <button
                    key={n.id}
                    className={`${styles.item} ${idx === activeIdx ? styles.itemActive : ''}`}
                    onClick={() => onPick(n)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className={`${styles.itemIcon} ${styles.iconNav}`}>→</span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{(n as { label: string }).label}</span>
                    </span>
                    <span className={styles.itemArrow}>↵</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
