"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";
import { formatPrix } from "@/lib/money";

const DISMISS_KEY = "cosy:fidelite-popup-vu";

interface ParametresAffiches {
  pointsRequis: number;
  montantMinimumCentimes: number;
  valeurBonCentimes: number;
}

export function LoyaltyPopup() {
  const [parametres, setParametres] = useState<ParametresAffiches | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<"info" | "inscription" | "connexion">("info");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("parametres_fidelite")
      .select("points_requis, montant_minimum_centimes, valeur_bon_centimes")
      .single()
      .then(({ data }) => {
        if (data) {
          setParametres({
            pointsRequis: data.points_requis,
            montantMinimumCentimes: data.montant_minimum_centimes,
            valeurBonCentimes: data.valeur_bon_centimes,
          });
        }
      });

    try {
      if (!localStorage.getItem(DISMISS_KEY)) {
        setOuvert(true);
      }
    } catch {
      // localStorage indisponible (navigation privée, etc.) : le pop-up ne s'ouvre
      // pas automatiquement, mais reste accessible via le bouton "🎁 Fidélité".
    }
  }, []);

  function fermer() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignoré : au pire le pop-up réapparaîtra à la prochaine visite
    }
    setOuvert(false);
  }

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault();
    setEnvoiEnCours(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({ email, password: motDePasse });

    setEnvoiEnCours(false);
    if (error) {
      setMessage("Impossible de créer le compte. Vérifiez votre email et réessayez.");
      return;
    }
    setMessage("Compte créé ! Vous cumulez des points dès votre prochaine commande.");
  }

  async function handleConnexion(e: React.FormEvent) {
    e.preventDefault();
    setEnvoiEnCours(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });

    setEnvoiEnCours(false);
    if (error) {
      setMessage("Identifiants incorrects.");
      return;
    }
    setMessage("Connecté ! Vos prochaines commandes compteront pour votre fidélité.");
  }

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="fixed bottom-24 right-4 z-40 rounded-pill bg-cosy-pink px-4 py-2 text-sm font-bold text-white shadow-lg"
      >
        🎁 Fidélité
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-extrabold text-cosy-pink">Programme fidélité</h2>
              <button onClick={fermer} aria-label="Fermer" className="text-cosy-ink/50">
                ✕
              </button>
            </div>

            {parametres && (
              <p className="mt-3 text-sm text-cosy-ink/80">
                Pour chaque commande d&apos;au moins {formatPrix(parametres.montantMinimumCentimes)},
                gagnez 1 point. Au bout de {parametres.pointsRequis} points, recevez un bon d&apos;achat
                de {formatPrix(parametres.valeurBonCentimes)} utilisable dans toute la boutique !
              </p>
            )}

            {mode === "info" && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setMode("inscription")}
                  className="flex-1 rounded-pill bg-cosy-pink py-2 text-sm font-bold text-white"
                >
                  Créer un compte
                </button>
                <button
                  onClick={() => setMode("connexion")}
                  className="flex-1 rounded-pill border border-cosy-pink py-2 text-sm font-bold text-cosy-pink"
                >
                  Se connecter
                </button>
              </div>
            )}

            {(mode === "inscription" || mode === "connexion") && (
              <form
                onSubmit={mode === "inscription" ? handleInscription : handleConnexion}
                className="mt-4 space-y-3"
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  {envoiEnCours ? "..." : mode === "inscription" ? "Créer mon compte" : "Se connecter"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("info")}
                  className="w-full text-center text-xs text-cosy-ink/50 underline"
                >
                  Retour
                </button>
              </form>
            )}

            {message && <p className="mt-3 text-sm text-cosy-pink">{message}</p>}

            <button onClick={fermer} className="mt-4 w-full text-center text-xs text-cosy-ink/40 underline">
              Continuer sans compte
            </button>
          </div>
        </div>
      )}
    </>
  );
}
