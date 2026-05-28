import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { createCheckoutSession } from '@/lib/creem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CheckoutBody = {
  productId?: string;
  discountCode?: string;
};

export async function POST(request: NextRequest) {
  if (!process.env.CREEM_API_KEY) {
    console.error('[creem-checkout] CREEM_API_KEY 未配置');
    return NextResponse.json({ ok: false, error: 'payment_not_configured' }, { status: 500 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // 前端不必传 productId；默认用 env 的 CREEM_PRODUCT_ID(配置在服务端不暴露)
  const productId = body.productId?.trim() || process.env.CREEM_PRODUCT_ID?.trim();
  if (!productId) {
    return NextResponse.json({ ok: false, error: 'product_id_required' }, { status: 400 });
  }

  const origin =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, '') ||
    new URL(request.url).origin;

  const successUrl = `${origin}/api/payment/return`;
  const requestId = randomUUID();

  try {
    const checkout = await createCheckoutSession({
      productId,
      requestId,
      successUrl,
      customer: session.user.email ? { email: session.user.email } : undefined,
      // metadata 会随 webhook 回传,用来把订阅落到具体用户
      metadata: {
        userId: session.user.id,
        uid: (session.user as { uid?: string | null }).uid ?? null,
        requestId,
      },
      discountCode: body.discountCode,
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: checkout.checkout_url,
      checkoutId: checkout.id,
    });
  } catch (err) {
    console.error('[creem-checkout] 创建失败', err);
    return NextResponse.json({ ok: false, error: 'checkout_create_failed' }, { status: 502 });
  }
}
