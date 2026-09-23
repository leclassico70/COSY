import { requireStaff } from "@/lib/supabase/requireStaff";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { crediterFidelite } from "@/lib/fidelite";
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

  const { data: commandeAvant } = await supabase
    .from("commandes")
    .select("statut, client_id")
    .eq("id", id)
    .maybeSingle();

  if (!commandeAvant) {
    return Response.json({ error: "commande introuvable" }, { status: 404 });
  }

  const { error } = await supabase
    .from("commandes")
    .update({ statut: statut as StatutCommande })
    .eq("id", id);

  if (error) {
    return Response.json({ error: "impossible de mettre à jour le statut" }, { status: 500 });
  }

  // Le point de fidélité n'est crédité qu'au premier passage à "prête" (jamais si la
  // commande était déjà prête), pour que le client ait effectivement reçu sa commande
  // avant d'être récompensé, et pour ne pas créditer deux fois sur un appel répété.
  if (statut === "prete" && commandeAvant.statut !== "prete" && commandeAvant.client_id) {
    const { data: lignes } = await supabase
      .from("commande_lignes")
      .select("prix_unitaire_centimes, quantite")
      .eq("commande_id", id);

    const totalCentimes = (lignes ?? []).reduce(
      (somme, ligne) => somme + ligne.prix_unitaire_centimes * ligne.quantite,
      0
    );

    await crediterFidelite(supabase, commandeAvant.client_id, totalCentimes, id);
  }

  return Response.json({ ok: true }, { status: 200 });
}
