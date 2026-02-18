import { Suspense } from 'react';
import AuthPageClient from './AuthPageClient';
import AppLoadingState from '@/components/ui/AppLoadingState';

const AuthPage = () => (
  <Suspense
    fallback={
      <AppLoadingState title="Opening your space..." />
    }
  >
    <AuthPageClient />
  </Suspense>
);

export default AuthPage;
