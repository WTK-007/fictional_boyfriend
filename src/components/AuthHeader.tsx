'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface MeUser {
  id: string;
  uid: string;
  email: string | null;
  nickname: string | null;
}

const UID_STORAGE_KEY = 'fb_user_uid';

export function AuthHeader() {
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
    return <div className="h-9" aria-hidden />;
  }

  return (
    <div className="flex items-center gap-2">
      {user ? (
        <>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.nickname || user.email || '已登录'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? '退出中…' : '退出'}
          </Button>
        </>
      ) : (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">登录</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">注册</Link>
          </Button>
        </>
      )}
    </div>
  );
}
