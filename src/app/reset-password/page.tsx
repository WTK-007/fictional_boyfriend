import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

export const metadata = {
  title: '重置密码',
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
