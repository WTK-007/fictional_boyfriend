'use client';

import { useEffect, useRef } from 'react';
import { authClient } from '@/lib/auth-client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
            context?: 'signin' | 'signup' | 'use';
            itp_support?: boolean;
          }) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const UID_STORAGE_KEY = 'fb_user_uid';

interface GoogleOneTapProps {
  nextPath?: string;
  context?: 'signin' | 'signup' | 'use';
}

export function GoogleOneTap({ nextPath = '/chat', context = 'signin' }: GoogleOneTapProps) {
  const { data: session, isPending } = authClient.useSession();
  const initialized = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const enabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true' && !!clientId;

  useEffect(() => {
    // 已登录 / 还在判断登录态 / 没开关 / 缺 client_id —— 都不挂
    if (!enabled || isPending || session) return;
    if (initialized.current) return;

    let cancelled = false;

    function init() {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId!,
        callback: async ({ credential }) => {
          try {
            const { data, error } = await authClient.signIn.social({
              provider: 'google',
              idToken: { token: credential },
            });
            if (error) {
              console.warn('[GoogleOneTap] sign-in failed:', error.message);
              return;
            }
            const uid = (data as { user?: { uid?: string | null } } | null)?.user?.uid;
            if (uid) {
              window.localStorage.setItem(UID_STORAGE_KEY, uid);
            }
            // Hard navigate — 触发整页重载,让所有 useSession hook 从新 cookie 重新初始化
            // (router.push 是 client-side navigation,nanostore 不会自动 refetch)
            window.location.assign(nextPath);
          } catch (err) {
            console.warn('[GoogleOneTap] sign-in error:', err);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
        context,
        itp_support: true,
      });
      window.google.accounts.id.prompt();
      initialized.current = true;
    }

    if (window.google?.accounts?.id) {
      init();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', init, { once: true });
      return () => {
        cancelled = true;
        existing.removeEventListener('load', init);
      };
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', init, { once: true });
    script.addEventListener('error', () => {
      console.warn('[GoogleOneTap] GSI script failed to load');
    });
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener('load', init);
    };
  }, [enabled, clientId, context, isPending, session, nextPath]);

  // 切到已登录态时取消可能正在显示的 prompt
  useEffect(() => {
    if (session && window.google?.accounts?.id) {
      window.google.accounts.id.cancel();
    }
  }, [session]);

  return null;
}
