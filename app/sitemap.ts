import { MetadataRoute } from 'next';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { buildThreadPath } from '@/lib/threads/thread-url';

type PublicThreadRow = {
  id: string;
  title: string | null;
  updated_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  privacy: string | null;
};

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://whisprspace.com';
  const now = new Date();

  const { data: publicThreads } = await supabaseAdmin
    .from('threads')
    .select('id,title,updated_at,expires_at,deleted_at,privacy')
    .eq('privacy', 'public')
    .is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
    .order('updated_at', { ascending: false })
    .limit(5000)
    .returns<PublicThreadRow[]>();

  const threadEntries: MetadataRoute.Sitemap = (publicThreads || [])
    .filter((thread) => thread.privacy === 'public' && !thread.deleted_at)
    .map((thread) => ({
      url: `${baseUrl}${buildThreadPath({ id: thread.id, title: thread.title || undefined })}`,
      lastModified: thread.updated_at ? new Date(thread.updated_at) : now,
      changeFrequency: 'hourly',
      priority: 0.8,
    }));

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/threads`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/inbox`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/profile`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/community-guidelines`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...threadEntries,
  ];
}
