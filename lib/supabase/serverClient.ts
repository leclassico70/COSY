import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

// Next.js 15+ (this project is on Next.js 16) made `cookies()` async, so this
// factory is async too — every call site must `await createSupabaseServerClient()`.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` was called from a Server Component, where cookies can't
            // be written. Safe to ignore as long as middleware refreshes the
            // user session (see the Supabase SSR guide for Next.js).
          }
        },
      },
    }
  );
}
