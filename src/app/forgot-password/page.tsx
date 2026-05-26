import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';

export const metadata = {
  title: '忘记密码',
};

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
