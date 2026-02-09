import { createClient } from '@/lib/core/supabase/server';
import MessageDrop from './components/MessageDrop';

interface MessageLinkPageProps {
  params: Promise<{ handle: string }>;
}

export default async function MessageLinkPage({ params }: MessageLinkPageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  const normalizedHandle = decodeURIComponent(handle).trim();

  let { data: userData } = await supabase
    .from('users')
    .select('*')
    .ilike('username', normalizedHandle)
    .single();

  if (!userData) {
    const { data: userByAnon } = await supabase
      .from('users')
      .select('*')
      .eq('anonymous_id', normalizedHandle)
      .single();
    userData = userByAnon;
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center px-6">
        <div className="text-center text-white">
          <h1 className="text-2xl font-semibold mb-2">User not found</h1>
          <p className="text-gray-400">The message link you followed is invalid.</p>
        </div>
      </div>
    );
  }

  const displayName = userData.username || userData.anonymous_id || 'Anonymous User';

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center px-4 py-16">
      <MessageDrop recipientId={userData.id} recipientName={displayName} />
    </div>
  );
}
