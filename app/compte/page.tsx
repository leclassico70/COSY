"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";
import { formatPrix } from "@/lib/money";

interface ParametresAffiches {
  pointsRequis: number;
  montantMinimumCentimes: number;
  valeurBonCentimes: number;
}

interface Solde {
  points: number;
  soldeBonsCentimes: number;
}

export default function ComptePage() {
  const [chargement, setChargement] = useState(true);
  const [emailConnecte, setEmailConnecte] = useState<string | null>(null);
  const [solde, setSolde] = useState<Solde | null>(null);
  const [parametres, setParametres] = useState<ParametresAffiches | null>(null);

  const [emailForm, setEmailForm] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function chargerCompte() {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setEmailConnecte(null);
      setSolde(null);
      setChargement(false);
      return;
    }

    setEmailConnecte(user.email ?? null);

    const [{ data: compte }, { data: param }] = await Promise.all([
      supabase
        .from("fidelite_comptes")
        .select("points, solde_bons_centimes")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("parametres_fidelite")
        .select("points_requis, montant_minimum_centimes, valeur_bon_centimes")
        .single(),
    ]);

    setSolde({ points: compte?.points ?? 0, soldeBonsCentimes: compte?.solde_bons_centimes ?? 0 });
    if (param) {
      setParametres({
        pointsRequis: param.points_requis,
        montantMinimumCentimes: param.montant_minimum_centimes,
        valeurBonCentimes: param.valeur_bon_centimes,
      });
    }
    setChargement(false);
  }

  useEffect(() => {
    // Chargement initial du compte depuis Supabase (source externe) au montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    chargerCompte();
  }, []);

  async function handleConnexion(e: React.FormEvent) {
    e.preventDefault();
    setEnvoiEnCours(true);
    setErreur(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: emailForm, password: motDePasse });

    setEnvoiEnCours(false);
    if (error) {
      setErreur("Identifiants incorrects.");
      return;
    }
    setChargement(true);
    await chargerCompte();
  }

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault();
    setEnvoiEnCours(true);
    setErreur(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({ email: emailForm, password: motDePasse });

    setEnvoiEnCours(false);
    if (error) {
      setErreur("Impossible de créer le compte. Vérifiez votre email et réessayez.");
      return;
    }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setErreur("Un compte existe déjà avec cet email. Connectez-vous plutôt.");
      return;
    }
    setChargement(true);
    await chargerCompte();
  }

  async function handleDeconnexion() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setEmailConnecte(null);
    setSolde(null);
  }

  if (chargement) {
    return <div className="mx-auto max-w-md px-4 py-12 text-center text-cosy-ink/50">Chargement...</div>;
  }

  if (!emailConnecte) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12">
        <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Mon compte</h1>
        <p className="mt-2 text-sm text-cosy-ink/70">
          Connectez-vous pour voir vos points et votre cagnotte fidélité.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setMode("connexion")}
            className={`flex-1 rounded-pill py-2 text-sm font-bold ${
              mode === "connexion" ? "bg-cosy-pink text-white" : "border border-cosy-pink text-cosy-pink"
            }`}
          >
            Se connecter
          </button>
          <button
            onClick={() => setMode("inscription")}
            className={`flex-1 rounded-pill py-2 text-sm font-bold ${
              mode === "inscription" ? "bg-cosy-pink text-white" : "border border-cosy-pink text-cosy-pink"
            }`}
          >
            Créer un compte
          </button>
        </div>

        <form
          onSubmit={mode === "connexion" ? handleConnexion : handleInscription}
          className="mt-4 space-y-3"
        >
          <input
            type="email"
            placeholder="Email"
            value={emailForm}
            onChange={(e) => setEmailForm(e.target.value)}
            className="w-full rounded border border-cosy-ink/20 px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="w-full rounded border border-cosy-ink/20 px-3 py-2 text-sm"
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={envoiEnCours}
            className="w-full rounded-pill bg-cosy-pink py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {envoiEnCours ? "..." : mode === "connexion" ? "Se connecter" : "Créer mon compte"}
          </button>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Mon compte</h1>
      <p className="mt-1 text-sm text-cosy-ink/60">{emailConnecte}</p>

      <div className="mt-6 rounded-lg border border-cosy-pink/20 bg-white p-6 text-center">
        <p className="font-display text-4xl font-black text-cosy-pink">{solde?.points ?? 0}</p>
        <p className="text-sm text-cosy-ink/60">
          point{(solde?.points ?? 0) > 1 ? "s" : ""} {parametres ? `sur ${parametres.pointsRequis}` : ""}
        </p>

        {solde && solde.soldeBonsCentimes > 0 && (
          <p className="mt-4 font-display text-lg font-extrabold text-cosy-pink">
            {formatPrix(solde.soldeBonsCentimes)} de bon disponible !
          </p>
        )}

        {parametres && (
          <p className="mt-4 text-xs text-cosy-ink/50">
            1 point par commande d&apos;au moins {formatPrix(parametres.montantMinimumCentimes)}. Tous les{" "}
            {parametres.pointsRequis} points : {formatPrix(parametres.valeurBonCentimes)} de bon.
          </p>
        )}
      </div>

      <button onClick={handleDeconnexion} className="mt-6 w-full text-center text-xs text-cosy-ink/40 underline">
        Se déconnecter
      </button>
    </div>
  );
}
