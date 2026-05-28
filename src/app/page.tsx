import { Suspense } from 'react';
import LandingPage from '@/components/landing/LandingPage';

export default function Home() {
  // LandingPage 内部用了 useSearchParams 读 Creem 回跳的 ?payment=success,
  // Next 16 静态导出阶段必须用 Suspense 包一层让它走 CSR bailout
  return (
    <Suspense fallback={null}>
      <LandingPage />
    </Suspense>
  );
}
