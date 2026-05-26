'use client';

import { useEffect } from 'react';

// Microsoft Clarity
// NEXT_PUBLIC_CLARITY_ID 未配置时 no-op,本地开发默认不污染生产 Clarity 数据
// SDK 内部依赖 window,必须放在 'use client' + useEffect 里
export default function ClarityAnalytics() {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  useEffect(() => {
    if (!clarityId) return;
    import('@microsoft/clarity')
      .then(({ default: Clarity }) => Clarity.init(clarityId))
      .catch(() => {
        // 优雅降级:埋点挂了不影响主流程
      });
  }, [clarityId]);

  return null;
}
