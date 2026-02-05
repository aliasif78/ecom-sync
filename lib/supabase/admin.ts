// Supabase
import { createClient } from '@supabase/supabase-js';

// Utils
import { getEnvVariables } from './utils/serverUtils';

export const createAdminClient = () => {
  const { supabaseUrl, supabaseSecretKey } = getEnvVariables();

  return createClient(supabaseUrl!, supabaseSecretKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
