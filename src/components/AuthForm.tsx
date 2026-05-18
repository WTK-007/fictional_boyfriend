'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  endpoint: string;
}> = {
  login: {
    title: '登录',
    submit: '登录',
    switchHint: '还没有账号？',
    switchLabel: '去注册',
    switchHref: '/register',
    endpoint: '/api/auth/login',
  },
  register: {
    title: '创建账号',
    submit: '注册',
    switchHint: '已经有账号？',
    switchLabel: '去登录',
    switchHref: '/login',
    endpoint: '/api/auth/register',
  },
};

const UID_STORAGE_KEY = 'fb_user_uid';

export function AuthForm({ mode }: AuthFormProps) {
  const copy = COPY[mode];
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const body: Record<string, string> = { email, password };
      if (mode === 'register' && nickname.trim()) {
        body.nickname = nickname.trim();
      }

      const res = await fetch(copy.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || '操作失败，请重试');
        return;
      }

      // 把现有的本地 uid 同步成账号绑定的 uid，复用现有聊天流
      if (data?.user?.uid && typeof window !== 'undefined') {
        window.localStorage.setItem(UID_STORAGE_KEY, data.user.uid);
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      console.error('Auth submit error:', err);
      setError('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
              placeholder={mode === 'register' ? '至少 6 位' : '请输入密码'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === 'register' ? 6 : 1}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="nickname">昵称（可选）</Label>
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

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? '处理中…' : copy.submit}
          </Button>
        </form>

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
