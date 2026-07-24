import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (!siteConfig.indexingEnabled) {
    return {
      rules: [
        // Allow social media crawlers to fetch OG images for share cards
        {
          userAgent: 'facebookexternalhit',
          allow: '/message/',
          disallow: '/',
        },
        {
          userAgent: 'Twitterbot',
          allow: '/message/',
          disallow: '/',
        },
        {
          userAgent: 'WhatsApp',
          allow: '/message/',
          disallow: '/',
        },
        {
          userAgent: 'LinkedInBot',
          allow: '/message/',
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
          '/my-threads',
          '/notifications',
          '/profile',
          '/groups',
          '/threads',
          '/invite/',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
