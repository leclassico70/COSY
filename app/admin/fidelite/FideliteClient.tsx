"use client";

import { useEffect, useState } from "react";
import { formatPrix } from "@/lib/money";

interface ParametresRow {
  points_requis: number;
  montant_minimum_centimes: number;
  valeur_bon_centimes: number;
}

interface CompteRecherche {
  userId: string;
  email: string;
  points: number;
  soldeBonsCentimes: number;
}

interface Props {
  parametresInitiaux: ParametresRow;
}

export function FideliteClient({ parametresInitiaux }: Props) {
  const [pointsRequis, setPointsRequis] = useState(String(parametresInitiaux.points_requis));
  const [montantMinimum, setMontantMinimum] = useState(
    (parametresInitiaux.montant_minimum_centimes / 100).toFixed(2)
  );
  const [valeurBon, setValeurBon] = useState((parametresInitiaux.valeur_bon_centimes / 100).toFixed(2));
  const [messageParametres, setMessageParametres] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [compte, setCompte] = useState<CompteRecherche | null>(null);
  const [erreurRecherche, setErreurRecherche] = useState<string | null>(null);
  const [ajustementPoints, setAjustementPoints] = useState("0");
  const [ajustementSolde, setAjustementSolde] = useState("0");
  const [motif, setMotif] = useState("");
  const [messageAjustement, setMessageAjustement] = useState<string | null>(null);

  const [listeComptes, setListeComptes] = useState<CompteRecherche[] | null>(null);
  const [chargementListe, setChargementListe] = useState(true);

  async function chargerListe() {
    setChargementListe(true);
    const res = await fetch("/api/admin/fidelite/comptes");
    if (res.ok) {
      const body = (await res.json()) as { comptes: CompteRecherche[] };
      setListeComptes(body.comptes);
    }
    setChargementListe(false);
  }

  useEffect(() => {
    // Chargement initial de la liste depuis l'API (source externe) au montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    chargerListe();
  }, []);

  async function enregistrerParametres(e: React.FormEvent) {
    e.preventDefault();
    setMessageParametres(null);

    const res = await fetch("/api/admin/fidelite/parametres", {
      method: "PATCH",
      body: JSON.stringify({
        pointsRequis: parseInt(pointsRequis, 10),
        montantMinimumCentimes: Math.round(parseFloat(montantMinimum.replace(",", ".")) * 100),
        valeurBonCentimes: Math.round(parseFloat(valeurBon.replace(",", ".")) * 100),
      }),
    });

    setMessageParametres(res.ok ? "Paramètres enregistrés." : "Échec de l'enregistrement.");
  }

  async function rechercherCompte(e: React.FormEvent) {
    e.preventDefault();
    setErreurRecherche(null);
    setCompte(null);

    const res = await fetch(`/api/admin/fidelite/comptes?email=${encodeURIComponent(email)}`);

    if (!res.ok) {
      setErreurRecherche(res.status === 404 ? "Aucun compte pour cet email." : "Recherche impossible.");
      return;
    }

    setCompte((await res.json()) as CompteRecherche);
  }

  async function appliquerAjustement(e: React.FormEvent) {
    e.preventDefault();
    if (!compte || !motif) return;
    setMessageAjustement(null);

    const res = await fetch("/api/admin/fidelite/comptes", {
      method: "PATCH",
      body: JSON.stringify({
        userId: compte.userId,
        deltaPoints: parseInt(ajustementPoints, 10) || 0,
        deltaSoldeCentimes: Math.round(parseFloat(ajustementSolde.replace(",", ".") || "0") * 100),
        motif,
      }),
    });

    if (!res.ok) {
      setMessageAjustement("Échec de l'ajustement.");
      return;
    }

    setMessageAjustement("Compte mis à jour.");
    setMotif("");
    setAjustementPoints("0");
    setAjustementSolde("0");
    rechercherCompte(e);
    chargerListe();
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Programme fidélité</h1>

      <section className="mt-8 rounded-lg border border-cosy-pink/20 p-4">
        <h2 className="font-display font-extrabold">Réglages</h2>
        <form onSubmit={enregistrerParametres} className="mt-3 space-y-3">
          <label className="block text-sm">
            Points requis avant récompense
            <input
              type="number"
              value={pointsRequis}
              onChange={(e) => setPointsRequis(e.target.value)}
              className="mt-1 w-full rounded border border-cosy-ink/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Montant minimum par commande (€)
            <input
              value={montantMinimum}
              onChange={(e) => setMontantMinimum(e.target.value)}
              className="mt-1 w-full rounded border border-cosy-ink/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Valeur du bon accordé (€)
            <input
              value={valeurBon}
              onChange={(e) => setValeurBon(e.target.value)}
              className="mt-1 w-full rounded border border-cosy-ink/20 px-3 py-2"
            />
          </label>
          <button type="submit" className="rounded-pill bg-cosy-pink px-4 py-2 text-sm font-bold text-white">
            Enregistrer
          </button>
          {messageParametres && <p className="text-sm text-cosy-pink">{messageParametres}</p>}
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-cosy-pink/20 p-4">
        <h2 className="font-display font-extrabold">Rechercher un client</h2>
        <form onSubmit={rechercherCompte} className="mt-3 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@client.fr"
            className="flex-1 rounded border border-cosy-ink/20 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-pill bg-cosy-pink px-4 py-2 text-sm font-bold text-white">
            Chercher
          </button>
        </form>
        {erreurRecherche && <p className="mt-2 text-sm text-red-600">{erreurRecherche}</p>}

        {compte && (
          <div className="mt-4 border-t border-cosy-pink/10 pt-4">
            <p className="text-sm">
              <strong>{compte.email}</strong> — {compte.points} points, cagnotte {formatPrix(compte.soldeBonsCentimes)}
            </p>

            <form onSubmit={appliquerAjustement} className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={ajustementPoints}
                  onChange={(e) => setAjustementPoints(e.target.value)}
                  placeholder="± points"
                  className="w-24 rounded border border-cosy-ink/20 px-2 py-1 text-sm"
                />
                <input
                  value={ajustementSolde}
                  onChange={(e) => setAjustementSolde(e.target.value)}
                  placeholder="± € cagnotte"
                  className="w-28 rounded border border-cosy-ink/20 px-2 py-1 text-sm"
                />
              </div>
              <input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Motif (obligatoire)"
                className="w-full rounded border border-cosy-ink/20 px-2 py-1 text-sm"
                required
              />
              <button
                type="submit"
                className="rounded-pill bg-cosy-pink px-4 py-1 text-sm font-bold text-white"
              >
                Appliquer
              </button>
              {messageAjustement && <p className="text-sm text-cosy-pink">{messageAjustement}</p>}
            </form>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-cosy-pink/20 p-4">
        <h2 className="font-display font-extrabold">Tous les membres</h2>
        {chargementListe && <p className="mt-2 text-sm text-cosy-ink/50">Chargement...</p>}
        {!chargementListe && listeComptes && listeComptes.length === 0 && (
          <p className="mt-2 text-sm text-cosy-ink/50">Aucun membre pour le moment.</p>
        )}
        {!chargementListe && listeComptes && listeComptes.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cosy-pink/10 text-left text-xs uppercase text-cosy-ink/50">
                  <th className="py-2 pr-2">Email</th>
                  <th className="py-2 pr-2">Points</th>
                  <th className="py-2 pr-2">Cagnotte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cosy-pink/10">
                {listeComptes.map((c) => (
                  <tr key={c.userId}>
                    <td className="py-2 pr-2">{c.email}</td>
                    <td className="py-2 pr-2">{c.points}</td>
                    <td className="py-2 pr-2">{formatPrix(c.soldeBonsCentimes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
