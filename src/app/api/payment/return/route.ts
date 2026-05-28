import { NextRequest, NextResponse } from 'next/server';
import { debugRedirectSignature, pickRedirectParams } from '@/lib/creem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Creem 完成支付后会跳到这里(success_url),query 上挂 checkout_id/order_id/...+signature
// 文档: https://docs.creem.io/features/checkout/checkout-api
//
// === 关于 redirect 签名校验 ===
// 经实测,Creem 文档里给的 redirect 签名算法与实际不符 (官方 NPM SDK
// `creem` v1.4.5 + 官方 BetterAuth 插件 `creem-betterauth` 都没有实现这个
// 校验,官方 Next.js demo 也是直接 trust + 反查 API)。
//
// 安全边界放在 /api/webhooks/creem:
//   - webhook 有 HMAC-SHA256(rawBody, webhook secret) 强校验
//   - 只有通过 webhook 校验的事件才会落 subscriptions 表 / 开通权益
// 所以这个 redirect 不验签也不会让用户白嫖会员——伪造 redirect 拿不到 DB 里的订阅记录。
//
// debugRedirectSignature 仍然会打 warn 日志,方便将来 Creem 修复签名规则时
// 直接验证是否对得上,届时把 if (!debug.match) 改回 return 401 即可。

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const apiKey = process.env.CREEM_API_KEY;

  const origin =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, '') ||
    url.origin;

  const redirect = (path: string) => NextResponse.redirect(`${origin}${path}`);

  const params = pickRedirectParams(url.searchParams);
  const checkoutId = params.all.checkout_id ?? '';

  // 仍然算一遍签名,但仅作为观察值打日志(不阻断流程)
  if (apiKey) {
    const debug = debugRedirectSignature(params, apiKey);
    if (debug.match) {
      console.log('[creem-return] 签名校验通过', { checkoutId });
    } else {
      console.warn(
        '[creem-return] 签名不匹配 (按官方实现忽略,以 webhook 为准)',
        { checkoutId, expected: debug.expectedSignature, received: debug.receivedSignature },
      );
    }
  }

  return redirect(`/?payment=success&status=ok&checkout_id=${encodeURIComponent(checkoutId)}`);
}
