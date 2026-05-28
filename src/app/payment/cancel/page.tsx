import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '已取消支付 · 纸片人男友',
};

export default function PaymentCancelPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">支付已取消</h1>
        <p className="mb-6 text-base leading-relaxed text-muted-foreground">
          这次没有扣款，你可以随时回来重新下单。
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            回到首页
          </Link>
        </div>
      </div>
    </main>
  );
}
