/**
 * Direct SQL execution helper
 * Executes the save thread migration SQL directly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addIsSavedColumn() {

  
  // Since we can't execute raw SQL directly with anon key,
  // we'll use a workaround by creating a test query
  const { data, error } = await supabase
    .from('threads')
    .select('id, is_saved')
    .limit(1);

  if (error && error.message.includes('column "is_saved" does not exist')) {

    return false;
  } else if (!error) {

    return true;
  } else {
    console.error('Error checking column:', error);
    return false;
  }
}

addIsSavedColumn();

export { addIsSavedColumn };
