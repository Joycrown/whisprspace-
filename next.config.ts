import type { NextConfig } from "next";

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: false, // process.env.NODE_ENV === "development",
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

const { withSentryConfig } = require("@sentry/nextjs");

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
