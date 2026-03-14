const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdmins() {
  const { data: admins, error: adminError } = await supabase
    .from('admin_users')
    .select('*');
  
  if (adminError) {
    console.error('Error fetching admin_users:', adminError);
  } else {
    console.log('admin_users:', admins);
  }

  const { data: userAdmins, error: userError } = await supabase
    .from('users')
    .select('id, email, anonymous_id, is_admin')
    .eq('is_admin', true);

  if (userError) {
    console.error('Error fetching users with is_admin=true:', userError);
  } else {
    console.log('users with is_admin=true:', userAdmins);
  }
}

checkAdmins();
