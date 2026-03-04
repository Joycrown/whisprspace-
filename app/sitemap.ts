import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/seo';

type MarketingRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const marketingRoutes: MarketingRoute[] = [
  { path: '', changeFrequency: 'daily', priority: 1 },
  { path: '/privacy-policy', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/community-guidelines', changeFrequency: 'monthly', priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteConfig.indexingEnabled) {
    return [];
  }

  const lastModified = new Date();

  return marketingRoutes.map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
