'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface MeUser {
  id: string;
  uid: string;
  email: string | null;
  nickname: string | null;
}

const UID_STORAGE_KEY = 'fb_user_uid';

export function LandingAuth() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const me: MeUser | null = data?.user ?? null;
        setUser(me);
        if (me?.uid && typeof window !== 'undefined') {
          window.localStorage.setItem(UID_STORAGE_KEY, me.uid);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(UID_STORAGE_KEY);
      }
      setUser(null);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  if (loading) {
    // 占位，避免登录态切换时跳动
    return <div style={{ width: 168, height: 40 }} aria-hidden />;
  }

  if (user) {
    return (
      <div className="landing-auth landing-auth--in">
        <span className="landing-auth-name">{user.nickname || user.email || '已登录'}</span>
        <button
          type="button"
          className="landing-auth-link"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? '退出中…' : '退出'}
        </button>
      </div>
    );
  }

  return (
    <div className="landing-auth">
      <Link href="/login" className="landing-auth-link">
        登录
      </Link>
      <Link href="/register" className="btn-login">
        注册
      </Link>
    </div>
  );
}
