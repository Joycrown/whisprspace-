'use client';

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-[#121212] text-white">
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-gray-400 text-center max-w-md">
            We ran into an unexpected error. Try again, or refresh the page.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => reset()}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

