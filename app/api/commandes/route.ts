import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { commandeEstQualifiante, appliquerPoints } from "@/lib/loyalty";

interface LigneEntree {
  produitId: string;
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
  if (!Array.isArray(body.lignes) || body.lignes.length === 0) {
    return Response.json({ error: "au moins une ligne requise" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const produitIds = [...new Set(body.lignes.map((ligne) => ligne.produitId))];

  const { data: produits, error: produitsError } = await supabase
    .from("produits")
    .select("id, nom, prix_centimes, disponible")
    .in("id", produitIds);

  if (produitsError) {
    return Response.json({ error: "impossible de vérifier les produits" }, { status: 500 });
  }

  const produitsParId = new Map((produits ?? []).map((produit) => [produit.id, produit]));

  for (const produitId of produitIds) {
    const produit = produitsParId.get(produitId);
    if (!produit || !produit.disponible) {
      return Response.json({ error: "produit invalide ou indisponible" }, { status: 400 });
    }
  }

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  const { data: commande, error: commandeError } = await supabase
    .from("commandes")
    .insert({ table_id: body.tableId, statut: "recue", client_id: user?.id ?? null })
    .select()
    .single();

  if (commandeError || !commande) {
    return Response.json({ error: "impossible de créer la commande" }, { status: 500 });
  }

  const lignesAvecPrix = body.lignes.map((ligne) => {
    const produit = produitsParId.get(ligne.produitId)!;
    return {
      commande_id: commande.id,
      produit_id: ligne.produitId,
      nom_produit: produit.nom,
      prix_unitaire_centimes: produit.prix_centimes,
      quantite: ligne.quantite,
    };
  });

  const { error: lignesError } = await supabase.from("commande_lignes").insert(lignesAvecPrix);

  if (lignesError) {
    await supabase.from("commandes").delete().eq("id", commande.id);
    return Response.json({ error: "impossible d'enregistrer les articles" }, { status: 500 });
  }

  if (user) {
    const totalCentimes = lignesAvecPrix.reduce(
      (somme, ligne) => somme + ligne.prix_unitaire_centimes * ligne.quantite,
      0
    );
    await crediterFidelite(supabase, user.id, totalCentimes, commande.id);
  }

  return Response.json({ id: commande.id }, { status: 201 });
}

async function crediterFidelite(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  userId: string,
  totalCentimes: number,
  commandeId: string
): Promise<void> {
  try {
    const { data: parametresRow } = await supabase
      .from("parametres_fidelite")
      .select("points_requis, montant_minimum_centimes, valeur_bon_centimes")
      .single();

    if (!parametresRow) return;

    const parametres = {
      pointsRequis: parametresRow.points_requis,
      montantMinimumCentimes: parametresRow.montant_minimum_centimes,
      valeurBonCentimes: parametresRow.valeur_bon_centimes,
    };

    if (!commandeEstQualifiante(totalCentimes, parametres)) return;

    const { data: compteExistant } = await supabase
      .from("fidelite_comptes")
      .select("id, points, solde_bons_centimes")
      .eq("user_id", userId)
      .maybeSingle();

    let compte = compteExistant;

    if (!compte) {
      const { data: nouveauCompte } = await supabase
        .from("fidelite_comptes")
        .insert({ user_id: userId })
        .select("id, points, solde_bons_centimes")
        .single();
      compte = nouveauCompte;
    }

    if (!compte) return;

    const resultat = appliquerPoints(
      { points: compte.points, soldeBonsCentimes: compte.solde_bons_centimes },
      1,
      parametres
    );

    await supabase
      .from("fidelite_comptes")
      .update({ points: resultat.points, solde_bons_centimes: resultat.soldeBonsCentimes })
      .eq("id", compte.id);

    await supabase.from("fidelite_mouvements").insert({
      compte_id: compte.id,
      delta_points: 1,
      delta_solde_centimes: resultat.soldeBonsCentimes - compte.solde_bons_centimes,
      motif: "Commande qualifiante",
      commande_id: commandeId,
    });
  } catch (erreur) {
    console.error("Échec de la mise à jour de la fidélité (commande créée normalement) :", erreur);
  }
}
