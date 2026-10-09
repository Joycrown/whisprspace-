import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'

const DEFAULT_PUBLIC_ASK_WINDOW_HOURS = 168

export const getPublicAskWindowHours = unstable_cache(
  async (): Promise<number> => {
    const { data } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', 'public_ask_reply_window_hours')
      .maybeSingle()
    const hours = Number(data?.value)
    return Number.isInteger(hours) && hours > 0 ? hours : DEFAULT_PUBLIC_ASK_WINDOW_HOURS
  },
  ['public-ask-window-hours'],
  { revalidate: 600 }
)

export const describeWindow = (hours: number) =>
  hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} hours`
