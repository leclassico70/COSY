import { requireStaff } from "@/lib/supabase/requireStaff";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import type { StatutCommande } from "@/lib/supabase/types";

const STATUTS_VALIDES: readonly StatutCommande[] = ["recue", "en_preparation", "prete"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();

  if (!staff) {
    return Response.json({ error: "authentification requise" }, { status: 401 });
  }

  const body = (await request.json()) as { statut?: string };
  const statut = body.statut;

  if (!statut || !STATUTS_VALIDES.includes(statut as StatutCommande)) {
    return Response.json({ error: "statut invalide" }, { status: 400 });
  }

  const { id } = await params;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("commandes")
    .update({ statut: statut as StatutCommande })
    .eq("id", id);

  if (error) {
    return Response.json({ error: "impossible de mettre à jour le statut" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
