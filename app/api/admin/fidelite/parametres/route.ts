import { requireStaff } from "@/lib/supabase/requireStaff";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import type { ParametresFidelite } from "@/lib/supabase/types";

export async function PATCH(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as {
    pointsRequis?: number;
    montantMinimumCentimes?: number;
    valeurBonCentimes?: number;
  };

  const champs: Partial<ParametresFidelite> = {};
  if (body.pointsRequis !== undefined) champs.points_requis = body.pointsRequis;
  if (body.montantMinimumCentimes !== undefined) champs.montant_minimum_centimes = body.montantMinimumCentimes;
  if (body.valeurBonCentimes !== undefined) champs.valeur_bon_centimes = body.valeurBonCentimes;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("parametres_fidelite").update(champs).eq("id", true);

  if (error) return Response.json({ error: "mise à jour impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}
