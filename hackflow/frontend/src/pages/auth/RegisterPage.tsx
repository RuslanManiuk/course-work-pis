import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import styles from './Auth.module.css';

function LightningIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

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
      setError(msg ?? 'Registration failed');
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      {/* Left brand panel */}
      <div className={styles.brandPanel}>
        <div className={styles.brandLogo}>
          <div className={styles.brandLogoMark}>
            <LightningIcon />
          </div>
          <span className={styles.brandLogoText}>HackFlow</span>
        </div>
        <p className={styles.brandTagline}>
          Build<span className={styles.brandTaglineDot}>.</span>
          {' '}Compete<span className={styles.brandTaglineDot}>.</span>
          {' '}Win<span className={styles.brandTaglineDot}>.</span>
        </p>
        <p className={styles.brandSub}>
          Create your account and start building something amazing.
        </p>
      </div>

      {/* Right form panel */}
      <div className={styles.formPanel}>
        <div className={styles.card}>
          <h1 className={styles.title}>Create account</h1>
          <p className={styles.subtitle}>Join the hackathon platform</p>

          {error && (
            <div className={styles.errorBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Username</label>
              <input
                type="text"
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.passwordWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className={styles.switchText}>
            Already have an account? <Link to="/auth/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
