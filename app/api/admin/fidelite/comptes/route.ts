import { requireStaff } from "@/lib/supabase/requireStaff";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";

export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const email = new URL(request.url).searchParams.get("email");
  const supabase = createSupabaseServiceClient();

  if (!email) {
    // Pas d'email fourni : on renvoie la liste de tous les comptes fidélité
    // existants, pour la vue d'ensemble admin.
    const { data: comptes, error: comptesError } = await supabase
      .from("fidelite_comptes")
      .select("user_id, points, solde_bons_centimes")
      .order("points", { ascending: false });

    if (comptesError) return Response.json({ error: "recherche impossible" }, { status: 500 });

    const { data: utilisateurs, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) return Response.json({ error: "recherche impossible" }, { status: 500 });

    const emailParId = new Map(utilisateurs.users.map((u) => [u.id, u.email ?? ""]));

    const liste = (comptes ?? []).map((c) => ({
      userId: c.user_id,
      email: emailParId.get(c.user_id) ?? "(email inconnu)",
      points: c.points,
      soldeBonsCentimes: c.solde_bons_centimes,
    }));

    return Response.json({ comptes: liste });
  }

  const { data: utilisateurs, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) return Response.json({ error: "recherche impossible" }, { status: 500 });

  const utilisateur = utilisateurs.users.find((u) => u.email === email);
  if (!utilisateur) return Response.json({ error: "aucun compte pour cet email" }, { status: 404 });

  const { data: compte } = await supabase
    .from("fidelite_comptes")
    .select("id, points, solde_bons_centimes")
    .eq("user_id", utilisateur.id)
    .maybeSingle();

  return Response.json({
    userId: utilisateur.id,
    email: utilisateur.email,
    points: compte?.points ?? 0,
    soldeBonsCentimes: compte?.solde_bons_centimes ?? 0,
  });
}

export async function PATCH(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as {
    userId: string;
    deltaPoints?: number;
    deltaSoldeCentimes?: number;
    motif: string;
  };

  if (!body.motif) {
    return Response.json({ error: "motif requis" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: compteExistant } = await supabase
    .from("fidelite_comptes")
    .select("id, points, solde_bons_centimes")
    .eq("user_id", body.userId)
    .maybeSingle();

  let compte = compteExistant;

  if (!compte) {
    const { data: nouveauCompte, error: creationError } = await supabase
      .from("fidelite_comptes")
      .insert({ user_id: body.userId })
      .select("id, points, solde_bons_centimes")
      .single();

    if (creationError || !nouveauCompte) {
      return Response.json({ error: "impossible de créer le compte" }, { status: 500 });
    }
    compte = nouveauCompte;
  }

  const deltaPoints = body.deltaPoints ?? 0;
  const deltaSoldeCentimes = body.deltaSoldeCentimes ?? 0;

  // Un ajustement (ex: faute de frappe sur le montant) ne doit jamais faire
  // passer le solde du client sous zéro.
  const nouveauxPoints = Math.max(0, compte.points + deltaPoints);
  const nouveauSolde = Math.max(0, compte.solde_bons_centimes + deltaSoldeCentimes);

  const { error: updateError } = await supabase
    .from("fidelite_comptes")
    .update({
      points: nouveauxPoints,
      solde_bons_centimes: nouveauSolde,
    })
    .eq("id", compte.id);

  if (updateError) return Response.json({ error: "mise à jour impossible" }, { status: 500 });

  // On journalise le delta réellement appliqué (après plancher à zéro),
  // pas la valeur brute demandée, pour que l'historique reflète la réalité.
  const { error: mouvementError } = await supabase.from("fidelite_mouvements").insert({
    compte_id: compte.id,
    delta_points: nouveauxPoints - compte.points,
    delta_solde_centimes: nouveauSolde - compte.solde_bons_centimes,
    motif: body.motif,
    cree_par: staff.id,
  });

  if (mouvementError) return Response.json({ error: "mouvement non enregistré" }, { status: 500 });

  return Response.json({ ok: true }, { status: 200 });
}
