import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

/**
 * Returns a server-only Supabase client.
 * Uses SUPABASE_SECRET_KEY (service_role) when present to bypass RLS securely on the server.
 * Falls back to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for development when secret key is not yet configured.
 *
 * CRITICAL: This module is marked 'server-only' and must NEVER be imported into client components.
 */
export function getSupabaseServer(): SupabaseClient {
  if (serverClient) return serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  const keyToUse = secretKey || publishableKey;
  if (!keyToUse) {
    throw new Error("Neither SUPABASE_SECRET_KEY nor NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is configured.");
  }

  serverClient = createClient(url, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverClient;
}
