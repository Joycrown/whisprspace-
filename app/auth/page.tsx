import { Suspense } from 'react';
import AuthPageClient from './AuthPageClient';

const AuthPage = () => (
  <Suspense
    fallback={
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }
  >
    <AuthPageClient />
  </Suspense>
);

export default AuthPage;
