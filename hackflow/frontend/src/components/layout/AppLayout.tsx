import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatches } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import styles from './AppLayout.module.css';
import NotificationBell from '@/components/ui/NotificationBell';
import CommandPalette from '@/components/ui/CommandPalette';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function LightningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function TeamsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}

function GavelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: string[] | null;
  hotkey?: string;
};

type NavSection = {
  label: string | null;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: null,
    items: [
      { to: '/dashboard',  label: 'Dashboard',  icon: <DashboardIcon />, roles: null, hotkey: 'D' },
      { to: '/hackathons', label: 'Hackathons', icon: <TrophyIcon />,    roles: null, hotkey: 'H' },
    ],
  },
  {
    label: 'Compete',
    items: [
      { to: '/teams',    label: 'My Teams',  icon: <TeamsIcon />,  roles: ['hacker', 'organizer'] },
      { to: '/helpdesk', label: 'Help Desk', icon: <TicketIcon />, roles: ['hacker', 'mentor', 'organizer'] },
    ],
  },
  {
    label: 'Evaluate',
    items: [
      { to: '/judging', label: 'Judging', icon: <GavelIcon />, roles: ['judge', 'organizer'] },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/profile', label: 'My Profile', icon: <ProfileIcon />, roles: null },
    ],
  },
];

const roleColor: Record<string, string> = {
  hacker:    'var(--color-primary)',
  judge:     'var(--color-accent)',
  mentor:    'var(--color-success)',
  organizer: 'var(--color-warning)',
};

// ── Header crumb helper ───────────────────────────────────────────────────────

function pathTitle(pathname: string): { section: string; current: string } {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { section: '', current: 'Dashboard' };

  const root = parts[0];
  const map: Record<string, { section: string; current: string }> = {
    dashboard:  { section: 'Home',     current: 'Dashboard' },
    hackathons: { section: 'Compete',  current: parts.length > 1 ? 'Hackathon' : 'Hackathons' },
    teams:      { section: 'Compete',  current: parts.length > 1 ? 'Team' : 'My Teams' },
    workspace:  { section: 'Compete',  current: 'Workspace' },
    helpdesk:   { section: 'Compete',  current: 'Help Desk' },
    judging:    { section: 'Evaluate', current: 'Judging' },
    profile:    { section: 'Account',  current: 'My Profile' },
    admin:      { section: 'Manage',   current: 'Admin' },
  };
  return map[root] ?? { section: '', current: root };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  useMatches();

  const { section, current } = pathTitle(location.pathname);
  const userRoleColor = roleColor[user?.role ?? ''] ?? 'var(--text-muted)';

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl+K hotkey
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        {/* Logo + status */}
        <div className={styles.logoBlock}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>
              <LightningIcon />
            </div>
            <span className={styles.logoText}>HackFlow</span>
          </div>
          <span className={styles.statusChip}>
            <span className={styles.statusDot} />
            sys:online
          </span>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {navSections.map((section, si) => {
            const visibleItems = section.items.filter(
              (item) => !item.roles || item.roles.includes(user?.role ?? '')
            );
            if (!visibleItems.length) return null;
            return (
              <div key={section.label ?? `section-${si}`} className={styles.navSection}>
                {section.label && (
                  <span className={styles.navSectionLabel}>{section.label}</span>
                )}
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                    }
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.hotkey && (
                      <span className={styles.navHotkey}>{item.hotkey}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}

          {/* Admin — organizer only */}
          {user?.role === 'organizer' && (
            <div className={styles.navSection}>
              <span className={styles.navSectionLabel}>Manage</span>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                <span className={styles.navIcon}><SettingsIcon /></span>
                <span className={styles.navLabel}>Admin</span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* User block */}
        <div className={styles.userBlock}>
          <div className={styles.avatarWrap} data-role={user?.role}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>
                {user?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className={styles.avatarOnline} />
          </div>
          <div className={styles.userInfo}>
            <span className={styles.username}>{user?.username}</span>
            <span
              className={styles.userRole}
              style={{ color: userRoleColor }}
            >
              {user?.role}
            </span>
          </div>
          <button className={styles.logoutBtn} onClick={signOut} title="Sign out" aria-label="Sign out">
            <SignOutIcon />
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {section && (
              <>
                <span className={styles.crumb}>{section}</span>
                <span className={styles.crumbSeparator}>/</span>
              </>
            )}
            <span className={styles.crumbCurrent}>{current}</span>
          </div>
          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.searchBox}
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
            >
              <SearchIcon />
              <span>$ grep -r hackathon teams/</span>
              <kbd>⌘K</kbd>
            </button>
            <span
              className={styles.roleChip}
              style={{ color: userRoleColor }}
            >
              <span className={styles.roleChipDot} />
              {user?.role}
            </span>
            <NotificationBell />
          </div>
        </header>
        <main className={styles.content}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
