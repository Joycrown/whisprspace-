import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (!siteConfig.indexingEnabled) {
    return {
      rules: [
        // Allow social media crawlers to fetch OG images for share cards
        {
          userAgent: 'facebookexternalhit',
          allow: ['/message/', '/stories/'],
          disallow: '/',
        },
        {
          userAgent: 'Twitterbot',
          allow: ['/message/', '/stories/'],
          disallow: '/',
        },
        {
          userAgent: 'WhatsApp',
          allow: ['/message/', '/stories/'],
          disallow: '/',
        },
        {
          userAgent: 'LinkedInBot',
          allow: ['/message/', '/stories/'],
          disallow: '/',
        },
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
      host: siteConfig.url,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/auth',
          '/inbox',
          '/dm/',
          '/my-discussions',
          '/my-threads',
          '/notifications',
          '/profile',
          '/groups',
          '/discussions',
          '/threads',
          '/invite/',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
