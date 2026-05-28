'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { GoogleOneTap } from '@/components/GoogleOneTap';

type Mode = 'login' | 'register';

interface AuthFormProps {
  mode: Mode;
}

const COPY: Record<Mode, {
  title: string;
  submit: string;
  switchHint: string;
  switchLabel: string;
  switchHref: string;
}> = {
  login: {
    title: '登录',
    submit: '登录',
    switchHint: '还没有账号?',
    switchLabel: '去注册',
    switchHref: '/register',
  },
  register: {
    title: '创建账号',
    submit: '注册',
    switchHint: '已经有账号?',
    switchLabel: '去登录',
    switchHref: '/login',
  },
};

const UID_STORAGE_KEY = 'fb_user_uid';

export function AuthForm({ mode }: AuthFormProps) {
  const copy = COPY[mode];
  const router = useRouter();
  const searchParams = useSearchParams();
  // 注册/登录/Google OAuth 默认都跳到 /chat;若 URL 带 ?next=xxx 则尊重原意图
  const nextPath = searchParams.get('next') || '/chat';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const needsTurnstile = !!turnstileSiteKey;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true';

  function resetTurnstile() {
    if (needsTurnstile) {
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  }

  function syncUidToLocalStorage(user: unknown) {
    if (typeof window === 'undefined') return;
    const uid = (user as { uid?: string | null } | null | undefined)?.uid;
    if (uid) {
      window.localStorage.setItem(UID_STORAGE_KEY, uid);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || googleSubmitting) return;
    if (needsTurnstile && !turnstileToken) {
      setError('请先完成人机验证');
      return;
    }
    setError(null);
    setSubmitting(true);

    const headers: Record<string, string> = {};
    if (needsTurnstile && turnstileToken) {
      headers['x-turnstile-token'] = turnstileToken;
    }

    try {
      if (mode === 'register') {
        const { data, error: err } = await authClient.signUp.email(
          {
            email,
            password,
            name: nickname.trim() || email.split('@')[0],
          },
          { headers },
        );
        if (err) {
          setError(err.message || '注册失败,请重试');
          resetTurnstile();
          return;
        }
        syncUidToLocalStorage(data?.user);
      } else {
        const { data, error: err } = await authClient.signIn.email(
          { email, password },
          { headers },
        );
        if (err) {
          setError(err.message || '邮箱或密码错误');
          resetTurnstile();
          return;
        }
        syncUidToLocalStorage(data?.user);
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      console.error('Auth submit error:', err);
      setError('网络异常,请稍后重试');
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (submitting || googleSubmitting) return;
    setError(null);
    setGoogleSubmitting(true);
    try {
      // 重定向流:浏览器跳到 Google → 回 /api/auth/callback/google → 回 callbackURL
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: nextPath,
      });
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Google 登录失败,请稍后重试');
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <GoogleOneTap nextPath={nextPath} context={mode === 'register' ? 'signup' : 'signin'} />
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">纸片人男友 · 邮箱账户</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === 'register' ? 8 : 1}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="nickname">昵称(可选)</Label>
              <Input
                id="nickname"
                type="text"
                autoComplete="nickname"
                placeholder="留空则使用邮箱前缀"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={50}
              />
            </div>
          )}

          {needsTurnstile && (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={turnstileSiteKey!}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
                options={{ theme: 'light' }}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || googleSubmitting || (needsTurnstile && !turnstileToken)}
          >
            {submitting ? '处理中…' : copy.submit}
          </Button>
        </form>

        {googleEnabled && (
          <>
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">或</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={submitting || googleSubmitting}
            >
              <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.11A6.6 6.6 0 0 1 5.47 12c0-.73.13-1.45.36-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                />
              </svg>
              使用 Google 账号继续
            </Button>
          </>
        )}

        {mode === 'login' && (
          <p className="text-center text-sm">
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              忘记密码?
            </Link>
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {copy.switchHint}
          <Link href={copy.switchHref} className="ml-1 font-medium text-primary hover:underline">
            {copy.switchLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
