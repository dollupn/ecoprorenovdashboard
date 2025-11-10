import "../env.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export const getServiceSupabaseClient = (): SupabaseClient => {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Les identifiants Supabase ne sont pas configurés pour le serveur API. Définissez la variable d'environnement SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY)."
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return cachedClient;
};
