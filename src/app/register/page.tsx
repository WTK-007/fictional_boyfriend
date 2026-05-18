import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';

export const metadata = {
  title: '注册',
};

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
