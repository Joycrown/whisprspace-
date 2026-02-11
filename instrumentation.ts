export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  const isProd = process.env.NODE_ENV === "production";

  // Avoid pulling Sentry/OTel into dev unless explicitly enabled.
  if (!dsn || !isProd) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");

  const tracesSampleRate = Number(
    process.env.SENTRY_TRACES_SAMPLE_RATE ??
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
      0.1
  );

  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.NEXT_PUBLIC_APP_ENV ||
      process.env.NODE_ENV,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    sendDefaultPii: false,
  });
}
