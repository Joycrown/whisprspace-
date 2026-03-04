import type { NextConfig } from "next";
import withPWAFactory from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = withPWAFactory({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const isAppDeployment = process.env.DEPLOYMENT_TARGET?.trim().toLowerCase() === "app";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    if (!isAppDeployment) {
      return [];
    }

    return [
      {
        source: '/',
        destination: '/auth',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /@opentelemetry\/instrumentation/ },
      { module: /@prisma\/instrumentation/ },
    ];
    return config;
  },
};

const pwaConfig = withPWA(nextConfig);

const sentryOrg = process.env.SENTRY_ORG?.trim();
const sentryProject = process.env.SENTRY_PROJECT?.trim();
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
const sentryEnabled = Boolean(sentryOrg && sentryProject && sentryAuthToken);

const sentryBuildOptions = {
  silent: true,
  org: sentryOrg,
  project: sentryProject,
  authToken: sentryAuthToken,
  hideSourceMaps: true,
  disableLogger: true,
};

export default sentryEnabled
  ? withSentryConfig(pwaConfig, sentryBuildOptions)
  : pwaConfig;
