import { Metadata } from 'next';
import { createClient } from '@/lib/core/supabase/server';
import { siteConfig } from '@/lib/seo';
import { escapeLikePattern } from '@/lib/utils/username-validation';
import MessageDrop from './components/MessageDrop';

interface MessageLinkPageProps {
  params: Promise<{ handle: string }>;
}

// Bump this whenever the OG card design changes so social scrapers
// (WhatsApp/Facebook/Twitter) treat the preview as fresh and re-fetch the image
// instead of serving a stale, imageless cache. Format: ISO date of the change.
const OG_VERSION = '2026-07-24T03:00:00Z';

async function resolveUser(handle: string) {
  const supabase = await createClient();
  const normalizedHandle = decodeURIComponent(handle).trim();

  const { data: byUsername } = await supabase
    .from('users')
    .select('id, username, anonymous_id')
    .ilike('username', escapeLikePattern(normalizedHandle))
    .single();

  if (byUsername) return byUsername;

  const { data: byAnonId } = await supabase
    .from('users')
    .select('id, username, anonymous_id')
    .eq('anonymous_id', normalizedHandle)
    .single();

  return byAnonId ?? null;
}

export async function generateMetadata({ params }: MessageLinkPageProps): Promise<Metadata> {
  const { handle } = await params;
  const user = await resolveUser(handle);

  const displayName = user?.username || user?.anonymous_id || handle;
  const title = `Tell ${displayName} the truth.`;
  const description = 'No name. No trace. Just what you actually think. Send an anonymous message on WhisprSpace.';
  const url = `${siteConfig.appUrl}/message/${handle}`;
  // Point at the /og route handler (not the opengraph-image convention): it sets an
  // explicit Content-Length, which WhatsApp requires to render the thumbnail.
  const ogImageUrl = `${siteConfig.appUrl}/message/${handle}/og`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // Allow social crawlers (WhatsApp, Twitter, Facebook) to fetch the OG image
    // even though global indexing is off. noindex keeps it out of search results;
    // removing nofollow/noimageindex lets crawlers fetch og:image.
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
        noimageindex: false,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          // secureUrl → emits og:image:secure_url, which some scrapers
          // (older WhatsApp, iMessage) require before rendering a thumbnail.
          secureUrl: ogImageUrl,
          type: 'image/png',
          width: 1200,
          height: 630,
          alt: `Send ${displayName} an anonymous message`,
        },
      ],
    },
    // og:updated_time gives crawlers a freshness signal so a re-scrape after the
    // image is deployed isn't served from a stale imageless cache.
    // (og:image:secure_url and og:image:type are emitted by the openGraph.images
    // secureUrl/type fields above — no need to repeat them here.)
    other: {
      'og:updated_time': OG_VERSION,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function MessageLinkPage({ params }: MessageLinkPageProps) {
  const { handle } = await params;
  const userData = await resolveUser(handle);

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#0A0A10] flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-medium text-[#F2F2F6] mb-2">User not found</h1>
          <p className="text-[#8F8FA3] text-sm">The message link you followed is invalid.</p>
        </div>
      </div>
    );
  }

  const displayName = userData.username || userData.anonymous_id || 'Anonymous User';

  return (
    <div className="min-h-screen bg-[#0A0A10] flex items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Ambient aura — purely decorative */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 70%)',
        }}
      />
      <MessageDrop recipientId={userData.id} recipientName={displayName} />
    </div>
  );
}
