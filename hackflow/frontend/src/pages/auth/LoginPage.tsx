import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import styles from './Auth.module.css';

function LightningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

const BOOT_LINES = [
  { text: '[ OK ] PostgreSQL 16 ........... connected', type: 'ok' },
  { text: '[ OK ] Redis 7 .................. online',   type: 'ok' },
  { text: '[ OK ] ChromaDB ................. indexed',  type: 'ok' },
  { text: '[WARN] Discord bot .............. degraded', type: 'warn' },
  { text: '[ OK ] Gemini AI ................ ready',    type: 'ok' },
  { text: '[ OK ] WebSocket server ......... :8000',    type: 'ok' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        ?.response?.data?.detail?.message;
      setError(msg ?? 'auth failed — invalid credentials');
      setLoading(false);
    }
  }

  async function handleGithub() {
    const { data } = await import('@/api/auth').then((m) => m.authApi.githubRedirect());
    window.location.href = data.redirect_url;
  }

  return (
    <div className={styles.root}>
      {/* ── LEFT — boot panel ── */}
      <div className={styles.brandPanel}>
        <div className={styles.brandLogo}>
          <div className={styles.brandLogoMark}><LightningIcon /></div>
          <span className={styles.brandLogoText}>HackFlow</span>
        </div>

        <div className={styles.bootLog}>
          {BOOT_LINES.map((line, i) => (
            <div key={i} className={styles.bootLine} style={{ animationDelay: `${i * 120}ms` }}>
              {line.type === 'ok'   && <><span className={styles.bootOk}>{line.text.slice(0, 6)}</span>{line.text.slice(6)}</>}
              {line.type === 'warn' && <><span className={styles.bootWarn}>{line.text.slice(0, 6)}</span>{line.text.slice(6)}</>}
              {line.type === 'fail' && <><span className={styles.bootFail}>{line.text.slice(0, 6)}</span>{line.text.slice(6)}</>}
            </div>
          ))}
          <div className={styles.bootCursor}>▌</div>
          <div className={styles.bootSep} />
          <p className={styles.brandTagline}>
            Build<span className={styles.brandTaglineDot}>.</span><br />
            Hack<span className={styles.brandTaglineDot}>.</span><br />
            Win<span className={styles.brandTaglineDot}>.</span>
          </p>
          <p className={styles.brandSub}>
            Hackathon infrastructure for teams<br />that ship code under pressure.
          </p>
        </div>

        <div className={styles.sysInfo}>
          <div>sys: linux x86_64 · kernel 6.8.0 · uptime 14d 3h</div>
          <div>net: <span className={styles.ok}>●</span> eth0 up · latency 2ms</div>
          <div>auth: jwt HS256 · 127 sessions active</div>
        </div>
      </div>

      {/* ── RIGHT — form panel ── */}
      <div className={styles.formPanel}>
        <div className={styles.card}>
          <div className={styles.promptLine}>
            <span className={styles.promptUser}>root</span>@<span className={styles.promptHost}>hackflow</span>:<span className={styles.promptPath}>~/auth</span>$ ./login.sh<br />
            <span style={{ color: 'var(--text-muted)' }}>Initializing secure session... <span className={styles.promptReady}>ready</span></span>
          </div>

          <h1 className={styles.title}>// authenticate</h1>
          <p className={styles.subtitle}>enter credentials to proceed</p>

          {error && (
            <div className={styles.errorBox}>
              <span style={{ flexShrink: 0 }}>✗</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>// identity</label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@domain.tld"
                required
                autoComplete="email"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>// passphrase</label>
              <div className={styles.passwordWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? '$ authenticating...' : '$ ./auth --exec'}
            </button>
          </form>

          <div className={styles.divider}><span>or</span></div>

          <button className={styles.githubBtn} onClick={handleGithub}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577v-2.165c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            --github-oauth
          </button>

          <p className={styles.switchText}>
            no account? <Link to="/auth/register">register --new-user</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
