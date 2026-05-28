import { NextRequest, NextResponse } from 'next/server';
import { pickRedirectParams, verifyRedirectSignature } from '@/lib/creem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Creem 完成支付后会跳到这里(success_url),query 上挂 checkout_id/order_id/...+signature
// 文档: https://docs.creem.io/features/checkout/checkout-api
//
// 注意:真正开通会员的权威动作发生在 /api/webhooks/creem(有重试 + 强校验),
// 这个回跳只负责给用户一个跳转 + 用 API key 校验一次链接没被伪造。

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const apiKey = process.env.CREEM_API_KEY;

  const origin =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, '') ||
    url.origin;

  const redirect = (path: string) => NextResponse.redirect(`${origin}${path}`);

  if (!apiKey) {
    console.error('[creem-return] CREEM_API_KEY 未配置,跳过签名校验');
    return redirect('/?payment=success&status=unverified');
  }

  const params = pickRedirectParams(url.searchParams);
  const isValid = verifyRedirectSignature(params, apiKey);

  if (!isValid) {
    console.warn('[creem-return] 签名校验失败', {
      checkoutId: params.checkout_id,
      hasSignature: Boolean(params.signature),
    });
    return redirect('/?payment=success&status=invalid_signature');
  }

  const checkoutId = params.checkout_id ?? '';
  return redirect(`/?payment=success&status=ok&checkout_id=${encodeURIComponent(checkoutId)}`);
}
