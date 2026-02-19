import type { NextConfig } from "next";
import withPWAFactory from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = withPWAFactory({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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

const sentryWebpackPluginOptions = {
  silent: true,
  org: sentryOrg,
  project: sentryProject,
  authToken: sentryAuthToken,
};

const sentryBuildOptions = {
  hideSourceMaps: true,
  disableLogger: true,
};

export default sentryEnabled
  ? withSentryConfig(pwaConfig, sentryWebpackPluginOptions, sentryBuildOptions)
  : pwaConfig;
