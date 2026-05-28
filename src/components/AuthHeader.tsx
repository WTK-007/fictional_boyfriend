'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useUpgradeToPro } from '@/hooks/useUpgradeToPro';

const UID_STORAGE_KEY = 'fb_user_uid';

export function AuthHeader() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const { isUpgrading, handleUpgrade } = useUpgradeToPro('/');

  // session 拿到 uid 后同步到 localStorage,聊天 API 仍然用这个 uid
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const uid = (session?.user as { uid?: string | null } | null | undefined)?.uid;
    if (uid) {
      window.localStorage.setItem(UID_STORAGE_KEY, uid);
    }
  }, [session]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authClient.signOut();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(UID_STORAGE_KEY);
      }
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  if (isPending) {
    return <div className="h-9" aria-hidden />;
  }

  const user = session?.user;

  return (
    <div className="flex items-center gap-2">
      {user ? (
        <>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.name || user.email || '已登录'}
          </span>
          <Button size="sm" onClick={handleUpgrade} disabled={isUpgrading}>
            {isUpgrading ? '正在跳转…' : '升级 Pro'}
          </Button>
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
