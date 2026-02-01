export const getEnvVariables = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Missing key
  if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) throw new Error('Missing Supabase environment variables');

  // All envs found
  return { supabaseUrl, supabaseKey, supabaseServiceKey };
};
