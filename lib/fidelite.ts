import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { commandeEstQualifiante, appliquerPoints, type ParametresFidelite } from "@/lib/loyalty";

const TENTATIVES_MAX_CREDIT_FIDELITE = 2;

interface CompteFideliteLigne {
  id: string;
  points: number;
  solde_bons_centimes: number;
}

export async function crediterFidelite(
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

    const resultatCredit = await crediterCompteAvecConcurrence(supabase, compte, 1, parametres);

    if (!resultatCredit) return;

    const { compteAvant, resultat } = resultatCredit;

    await supabase.from("fidelite_mouvements").insert({
      compte_id: compteAvant.id,
      delta_points: 1,
      delta_solde_centimes: resultat.soldeBonsCentimes - compteAvant.solde_bons_centimes,
      motif: "Commande qualifiante",
      commande_id: commandeId,
    });
  } catch (erreur) {
    console.error("Échec de la mise à jour de la fidélité (commande créée normalement) :", erreur);
  }
}

// Verrouillage optimiste (WHERE points/solde inchangés) pour que deux commandes concurrentes
// sur le même compte se cumulent au lieu de s'écraser. Retente une fois avec le solde frais
// en cas de conflit, puis abandonne sans lever d'erreur.
async function crediterCompteAvecConcurrence(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  compteInitial: CompteFideliteLigne,
  pointsAjoutes: number,
  parametres: ParametresFidelite
): Promise<{ compteAvant: CompteFideliteLigne; resultat: ReturnType<typeof appliquerPoints> } | null> {
  let compte = compteInitial;

  for (let tentative = 0; tentative < TENTATIVES_MAX_CREDIT_FIDELITE; tentative++) {
    const resultat = appliquerPoints(
      { points: compte.points, soldeBonsCentimes: compte.solde_bons_centimes },
      pointsAjoutes,
      parametres
    );

    const { data: ligneMiseAJour } = await supabase
      .from("fidelite_comptes")
      .update({ points: resultat.points, solde_bons_centimes: resultat.soldeBonsCentimes })
      .eq("id", compte.id)
      .eq("points", compte.points)
      .eq("solde_bons_centimes", compte.solde_bons_centimes)
      .select("id")
      .maybeSingle();

    if (ligneMiseAJour) {
      return { compteAvant: compte, resultat };
    }

    const dernierEssai = tentative === TENTATIVES_MAX_CREDIT_FIDELITE - 1;
    if (dernierEssai) break;

    const { data: compteActuel } = await supabase
      .from("fidelite_comptes")
      .select("id, points, solde_bons_centimes")
      .eq("id", compte.id)
      .maybeSingle();

    if (!compteActuel) return null;

    compte = compteActuel;
  }

  return null;
}
