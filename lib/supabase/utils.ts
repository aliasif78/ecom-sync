export const getEnvVariables = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  // Missing key
  if (!supabaseUrl || !supabaseKey || !supabaseSecretKey) throw new Error('Missing Supabase environment variables');

  // All envs found
  return { supabaseUrl, supabaseKey, supabaseSecretKey };
};
