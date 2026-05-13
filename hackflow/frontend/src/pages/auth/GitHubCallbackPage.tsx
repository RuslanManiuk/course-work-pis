import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

export default function GitHubCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = params.get('code');
    if (!code) {
      navigate('/auth/login');
      return;
    }

    authApi.githubCallback(code).then(async ({ data }) => {
      setTokens(data.access_token, data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      navigate('/dashboard');
    }).catch(() => {
      navigate('/auth/login?error=github');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Completing sign-in…</p>
    </div>
  );
}
