import { Metadata } from 'next';
import { createClient } from '@/lib/core/supabase/server';
import { siteConfig } from '@/lib/seo';
import MessageDrop from './components/MessageDrop';

interface MessageLinkPageProps {
  params: Promise<{ handle: string }>;
}

async function resolveUser(handle: string) {
  const supabase = await createClient();
  const normalizedHandle = decodeURIComponent(handle).trim();

  const { data: byUsername } = await supabase
    .from('users')
    .select('id, username, anonymous_id')
    .ilike('username', normalizedHandle)
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
  const url = `${siteConfig.url}/message/${handle}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      type: 'website',
      images: [
        {
          url: `${siteConfig.url}/message/${handle}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `Send ${displayName} an anonymous message`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${siteConfig.url}/message/${handle}/opengraph-image`],
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
