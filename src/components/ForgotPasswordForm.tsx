'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      });
      if (err) {
        setError(err.message || '发送失败,请稍后重试');
        return;
      }
      // 不暴露邮箱是否存在,无论结果都展示同样的成功提示
      setDone(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('网络异常,请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">忘记密码</h1>
          <p className="text-sm text-muted-foreground">
            输入注册邮箱,我们会把重置链接发到你的信箱。
          </p>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm">
              如果该邮箱已注册,你会收到一封重置密码邮件。请检查收件箱(可能在垃圾邮件里)。
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">返回登录</Link>
            </Button>
          </div>
        ) : (
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
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '发送中…' : '发送重置链接'}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          想起来了?
          <Link href="/login" className="ml-1 font-medium text-primary hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
