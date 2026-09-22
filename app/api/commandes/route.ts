import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";

interface LigneEntree {
  produitId: string;
  nom: string;
  prixCentimes: number;
  quantite: number;
}

interface CreerCommandeEntree {
  tableId?: string;
  lignes?: LigneEntree[];
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreerCommandeEntree;

  if (!body.tableId) {
    return Response.json({ error: "tableId requis" }, { status: 400 });
  }
  if (!body.lignes || body.lignes.length === 0) {
    return Response.json({ error: "au moins une ligne requise" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: commande, error: commandeError } = await supabase
    .from("commandes")
    .insert({ table_id: body.tableId, statut: "recue" })
    .select()
    .single();

  if (commandeError || !commande) {
    return Response.json({ error: "impossible de créer la commande" }, { status: 500 });
  }

  const { error: lignesError } = await supabase.from("commande_lignes").insert(
    body.lignes.map((ligne) => ({
      commande_id: commande.id,
      produit_id: ligne.produitId,
      nom_produit: ligne.nom,
      prix_unitaire_centimes: ligne.prixCentimes,
      quantite: ligne.quantite,
    }))
  );

  if (lignesError) {
    return Response.json({ error: "impossible d'enregistrer les articles" }, { status: 500 });
  }

  return Response.json({ id: commande.id }, { status: 201 });
}
