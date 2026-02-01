// Supabase
import { createClient } from '@supabase/supabase-js';

// Utils
import { getEnvVariables } from './utils';

export const createAdminClient = () => {
  const { supabaseUrl, supabaseServiceKey } = getEnvVariables();

  return createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
