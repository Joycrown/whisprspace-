import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MainLayout from "@/components/Layout/MainLayout";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { RealtimeNotificationProvider } from "@/components/providers/RealtimeNotificationProvider";
import AnalyticsProvider from "@/components/providers/AnalyticsProvider";
import { QueryProvider } from "@/lib/react-query";
import { generateMetadata as generateSEO } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Viewport configuration for mobile optimization
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
};

// Add apple-mobile-web-app-capable and other PWA specific meta tags
export const metadata: Metadata = {
  ...generateSEO({
    title: "WhisprSpace - Anonymous Platform for Free Expression",
    description: "A digital sanctuary for honest expression without identity-based judgment. Share thoughts, join discussions, and connect anonymously on topics that matter.",
  }),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WhisprSpace",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden w-full max-w-full`}
      >
        <QueryProvider>
          <AnalyticsProvider>
            <AuthProvider>
              <ThemeProvider>
                <ToastProvider>
                  <RealtimeNotificationProvider />
                  <MainLayout>
                    {children}
                  </MainLayout>
                </ToastProvider>
              </ThemeProvider>
            </AuthProvider>
          </AnalyticsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
