import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";

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

  // Le point de fidélité n'est crédité que lorsque la commande est marquée "prête"
  // par le personnel (voir app/api/commandes/[id]/statut/route.ts), pas ici à la
  // simple validation du panier par le client.

  return Response.json({ id: commande.id }, { status: 201 });
}
