import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '支付成功 · 纸片人男友',
};

type Search = Promise<{
  status?: string;
  checkout_id?: string;
}>;

const STATUS_COPY: Record<
  string,
  { title: string; body: string }
> = {
  ok: {
    title: '支付成功 🎉',
    body: '会员权益正在为你开通，刷新一下就能享受完整体验啦。',
  },
  unverified: {
    title: '订单已确认，正在校验',
    body: '我们已收到 Creem 的回跳，但服务端尚未配置 API key，权益将在 webhook 确认后开通。',
  },
  invalid_signature: {
    title: '链接校验失败',
    body: '回跳链接里的签名异常，可能是被改写过。请稍候片刻，Creem 会通过 webhook 二次确认订单。',
  },
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const status = sp.status ?? 'ok';
  const copy = STATUS_COPY[status] ?? STATUS_COPY.ok;
  const checkoutId = sp.checkout_id;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mb-6 text-base leading-relaxed text-muted-foreground">{copy.body}</p>
        {checkoutId ? (
          <p className="mb-6 break-all text-xs text-muted-foreground/80">
            订单号: <span className="font-mono">{checkoutId}</span>
          </p>
        ) : null}
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            回到聊天
          </Link>
          <Link
            href="/chat"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            进入聊天页面
          </Link>
        </div>
      </div>
    </main>
  );
}
