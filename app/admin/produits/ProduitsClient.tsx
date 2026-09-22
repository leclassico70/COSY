"use client";

import { useState } from "react";
import { formatPrix } from "@/lib/money";
import type { Categorie, Produit } from "@/lib/supabase/types";

interface Props {
  categoriesInitiales: Categorie[];
  produitsInitiaux: Produit[];
}

interface ChampsProduit {
  nom: string;
  description: string;
  prixCentimes: number;
  categorieId: string;
}

export function ProduitsClient({ categoriesInitiales, produitsInitiaux }: Props) {
  const [categories] = useState(categoriesInitiales);
  const [produits, setProduits] = useState(produitsInitiaux);
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<ChampsProduit | null>(null);
  const [nouveauCategorieId, setNouveauCategorieId] = useState(categoriesInitiales[0]?.id ?? "");
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauPrix, setNouveauPrix] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function toggleDisponible(produit: Produit) {
    const disponible = !produit.disponible;
    setProduits((current) => current.map((p) => (p.id === produit.id ? { ...p, disponible } : p)));

    await fetch("/api/admin/produits", {
      method: "PATCH",
      body: JSON.stringify({ id: produit.id, disponible }),
    });
  }

  function commencerEdition(produit: Produit) {
    setErreur(null);
    setEnEdition(produit.id);
    setBrouillon({
      nom: produit.nom,
      description: produit.description,
      prixCentimes: produit.prix_centimes,
      categorieId: produit.categorie_id,
    });
  }

  async function enregistrerEdition(produitId: string) {
    if (!brouillon) return;

    setProduits((current) =>
      current.map((p) =>
        p.id === produitId
          ? {
              ...p,
              nom: brouillon.nom,
              description: brouillon.description,
              prix_centimes: brouillon.prixCentimes,
              categorie_id: brouillon.categorieId,
            }
          : p
      )
    );
    setEnEdition(null);

    const reponse = await fetch("/api/admin/produits", {
      method: "PATCH",
      body: JSON.stringify({
        id: produitId,
        nom: brouillon.nom,
        description: brouillon.description,
        prixCentimes: brouillon.prixCentimes,
        categorieId: brouillon.categorieId,
      }),
    });

    if (!reponse.ok) {
      setErreur("La mise à jour n'a pas pu être enregistrée. Réessayez.");
    }
  }

  async function supprimer(produitId: string) {
    setProduits((current) => current.filter((p) => p.id !== produitId));

    await fetch("/api/admin/produits", {
      method: "DELETE",
      body: JSON.stringify({ id: produitId }),
    });
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const prixCentimes = Math.round(parseFloat(nouveauPrix.replace(",", ".")) * 100);
    if (!nouveauNom || !nouveauCategorieId || Number.isNaN(prixCentimes)) return;

    const reponse = await fetch("/api/admin/produits", {
      method: "POST",
      body: JSON.stringify({
        categorieId: nouveauCategorieId,
        nom: nouveauNom,
        description: "",
        prixCentimes,
        photoUrl: null,
      }),
    });

    if (!reponse.ok) {
      setErreur("Le produit n'a pas pu être créé. Vérifiez les champs et réessayez.");
      return;
    }

    setNouveauNom("");
    setNouveauPrix("");
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Menu</h1>

      {categories.map((categorie) => (
        <section key={categorie.id} className="mt-8">
          <h2 className="font-display font-extrabold">
            {categorie.emoji} {categorie.nom}
          </h2>
          <ul className="mt-2 divide-y divide-cosy-pink/10">
            {produits
              .filter((p) => p.categorie_id === categorie.id)
              .map((produit) =>
                enEdition === produit.id && brouillon ? (
                  <li key={produit.id} className="space-y-2 py-3">
                    <input
                      value={brouillon.nom}
                      onChange={(e) => setBrouillon({ ...brouillon, nom: e.target.value })}
                      className="w-full rounded border border-cosy-ink/20 px-2 py-1 text-sm"
                      placeholder="Nom"
                    />
                    <input
                      value={brouillon.description}
                      onChange={(e) => setBrouillon({ ...brouillon, description: e.target.value })}
                      className="w-full rounded border border-cosy-ink/20 px-2 py-1 text-sm"
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={(brouillon.prixCentimes / 100).toFixed(2)}
                        onChange={(e) =>
                          setBrouillon({
                            ...brouillon,
                            prixCentimes: Math.round(parseFloat(e.target.value || "0") * 100),
                          })
                        }
                        className="w-24 rounded border border-cosy-ink/20 px-2 py-1 text-sm"
                      />
                      <select
                        value={brouillon.categorieId}
                        onChange={(e) => setBrouillon({ ...brouillon, categorieId: e.target.value })}
                        className="flex-1 rounded border border-cosy-ink/20 px-2 py-1 text-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => enregistrerEdition(produit.id)}
                        className="rounded-pill bg-cosy-pink px-3 py-1 text-xs font-bold text-white"
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => setEnEdition(null)}
                        className="rounded-pill border border-cosy-ink/20 px-3 py-1 text-xs"
                      >
                        Annuler
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={produit.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-semibold">{produit.nom}</p>
                      <p className="text-sm text-cosy-ink/60">{formatPrix(produit.prix_centimes)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={produit.disponible}
                          onChange={() => toggleDisponible(produit)}
                        />
                        Disponible
                      </label>
                      <button
                        onClick={() => commencerEdition(produit)}
                        className="text-sm text-cosy-pink underline"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => supprimer(produit.id)}
                        className="text-sm text-red-600 underline"
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                )
              )}
          </ul>
        </section>
      ))}

      <section className="mt-10 rounded-lg border border-cosy-pink/20 p-4">
        <h2 className="font-display font-extrabold">Ajouter un produit</h2>
        <form onSubmit={ajouter} className="mt-3 flex flex-wrap gap-2">
          <select
            value={nouveauCategorieId}
            onChange={(e) => setNouveauCategorieId(e.target.value)}
            className="rounded border border-cosy-ink/20 px-2 py-1 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
          <input
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
            placeholder="Nom du produit"
            className="rounded border border-cosy-ink/20 px-2 py-1 text-sm"
          />
          <input
            value={nouveauPrix}
            onChange={(e) => setNouveauPrix(e.target.value)}
            placeholder="Prix (ex: 4.90)"
            className="w-28 rounded border border-cosy-ink/20 px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded-pill bg-cosy-pink px-4 py-1 text-sm font-bold text-white">
            Ajouter
          </button>
        </form>
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
        <p className="mt-2 text-xs text-cosy-ink/50">
          La photo se gère ensuite depuis la fiche produit une fois créé (upload à venir dans un module
          dédié).
        </p>
      </section>
    </div>
  );
}
