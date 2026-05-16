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

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await register(email, username, password);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        ?.response?.data?.detail?.message;
      setError(msg ?? 'registration failed — try a different handle');
      setLoading(false);
    }
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
            <div key={i} className={styles.bootLine}>
              {line.type === 'ok'   && <><span className={styles.bootOk}>{line.text.slice(0, 6)}</span>{line.text.slice(6)}</>}
              {line.type === 'warn' && <><span className={styles.bootWarn}>{line.text.slice(0, 6)}</span>{line.text.slice(6)}</>}
              {line.type === 'fail' && <><span className={styles.bootFail}>{line.text.slice(0, 6)}</span>{line.text.slice(6)}</>}
            </div>
          ))}
          <div className={styles.bootSep} />
          <p className={styles.brandTagline}>
            Build<span className={styles.brandTaglineDot}>.</span><br />
            Hack<span className={styles.brandTaglineDot}>.</span><br />
            Win<span className={styles.brandTaglineDot}>.</span>
          </p>
          <p className={styles.brandSub}>
            Create your account and start<br />shipping code under pressure.
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
            <span className={styles.promptUser}>root</span>@<span className={styles.promptHost}>hackflow</span>:<span className={styles.promptPath}>~/auth</span>$ ./register.sh<br />
            <span style={{ color: 'var(--text-muted)' }}>Allocating new identity slot... <span className={styles.promptReady}>ready</span></span>
          </div>

          <h1 className={styles.title}>// register --new-user</h1>
          <p className={styles.subtitle}>create credentials to proceed</p>

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
              <label className={styles.label}>// handle</label>
              <input
                type="text"
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username (min 3 chars)"
                required
                minLength={3}
                autoComplete="username"
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
                  minLength={8}
                  autoComplete="new-password"
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
              {loading ? '$ allocating...' : '$ ./register --create'}
            </button>
          </form>

          <p className={styles.switchText}>
            have an account? <Link to="/auth/login">login --existing</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
