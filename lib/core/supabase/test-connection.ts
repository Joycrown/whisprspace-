// Test file - can be deleted after verification
import { supabase } from './client'

export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('_supabase_health_check')
      .select('*')
      .limit(1)
    
    if (error) {
      return true
    }
    return true
  } catch (err) {
    return false
  }
}

// For testing in development
if (process.env.NODE_ENV === 'development') {
  testConnection()
}
