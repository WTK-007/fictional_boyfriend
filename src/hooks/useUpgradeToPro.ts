'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/lib/auth-client';

// 共用的"升级 Pro"按钮逻辑:点击 → POST /api/payment/checkout → 跳 Creem 收银台
// 未登录态会跳 /login?next=<loginNext>(由调用方指定回跳锚点)
export function useUpgradeToPro(loginNext: string = '/') {
  const router = useRouter();
  const { data: session } = useSession();
  const [isUpgrading, setIsUpgrading] = useState(false);

  async function handleUpgrade() {
    if (!session?.user) {
      router.push('/login?next=' + encodeURIComponent(loginNext));
      return;
    }
    if (isUpgrading) return;
    setIsUpgrading(true);
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        checkoutUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.checkoutUrl) {
        console.error('[upgrade] checkout 创建失败', { status: res.status, data });
        window.alert('开通失败,请稍后再试。');
        setIsUpgrading(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('[upgrade] 网络错误', err);
      window.alert('网络异常,请检查连接后重试。');
      setIsUpgrading(false);
    }
  }

  return { isUpgrading, handleUpgrade, isLoggedIn: Boolean(session?.user) };
}
