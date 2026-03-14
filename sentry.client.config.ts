import * as Sentry from "@sentry/nextjs";

const tracesSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
    process.env.SENTRY_TRACES_SAMPLE_RATE ??
    0.1
);

const replaysSessionSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0
);

const replaysOnErrorSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 1.0
);

Sentry.init({
  enabled: process.env.NEXT_PUBLIC_APP_ENV === 'production',
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV,
  tracesSampleRate,
  replaysSessionSampleRate,
  replaysOnErrorSampleRate,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  sendDefaultPii: false,
});
