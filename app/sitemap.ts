import { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { siteConfig } from '@/lib/seo';
import { supabaseAdmin } from '@/lib/core/supabase/admin-client';
import { STORIES_FEED_TAG } from '@/lib/stories/server';
import { buildStoryPath } from '@/lib/stories/story-url';

export const revalidate = 3600;

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

const STORY_SITEMAP_LIMIT = 5000;

const getSitemapStories = unstable_cache(
  async () => {
    const { data } = await supabaseAdmin
      .from('stories')
      .select('id, title, last_episode_at')
      .eq('moderation_status', 'visible')
      .is('deleted_at', null)
      .order('last_episode_at', { ascending: false })
      .limit(STORY_SITEMAP_LIMIT);
    return data ?? [];
  },
  ['stories-sitemap'],
  { revalidate: 3600, tags: [STORIES_FEED_TAG] }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteConfig.indexingEnabled) {
    return [];
  }

  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = marketingRoutes.map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const stories = await getSitemapStories().catch(() => []);
  entries.push({ url: `${siteConfig.appUrl}/`, lastModified, changeFrequency: 'hourly', priority: 0.9 });
  for (const story of stories) {
    entries.push({
      url: `${siteConfig.appUrl}${buildStoryPath(story)}`,
      lastModified: new Date(story.last_episode_at),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  return entries;
}
