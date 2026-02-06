// Supabase
import { createBrowserClient } from '@supabase/ssr';

// Utils
import { getEnvVariables } from './utils/clientUtils';

// Will be used by client components
export const createClient = () => {
  const { supabaseUrl, supabaseKey } = getEnvVariables();
  return createBrowserClient(supabaseUrl, supabaseKey);
};
