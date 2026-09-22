import { createSupabaseServerClient } from "./serverClient";

export interface StaffUser {
  id: string;
  nom: string;
}

export async function requireStaff(): Promise<StaffUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membre } = await supabase
    .from("personnel")
    .select("id, nom")
    .eq("id", user.id)
    .maybeSingle();

  return membre ?? null;
}
