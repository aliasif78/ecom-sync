// Supabase
import { createBrowserClient } from '@supabase/ssr';

// Utils
import { getEnvVariables } from './utils';

export const createClient = () => {
  const { supabaseUrl, supabaseKey } = getEnvVariables();
  return createBrowserClient(supabaseUrl, supabaseKey);
};
