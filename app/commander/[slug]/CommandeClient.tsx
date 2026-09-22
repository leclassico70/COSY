"use client";

import { useState } from "react";
import { addItem, cartTotal, setQuantity, type CartItem } from "@/lib/cart";
import { formatPrix } from "@/lib/money";
import { saveOrderId } from "@/lib/orderSession";
import type { Categorie, Produit, TableRestaurant } from "@/lib/supabase/types";
import { OrdersStatus } from "./OrdersStatus";
import { LoyaltyPopup } from "./LoyaltyPopup";

interface Props {
  table: TableRestaurant;
  categories: Categorie[];
  produits: Produit[];
}

export function CommandeClient({ table, categories, produits }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [derniereCommandeId, setDerniereCommandeId] = useState<string | null>(null);

  function handleAjouter(produit: Produit) {
    setCart((current) =>
      addItem(current, {
        produitId: produit.id,
        nom: produit.nom,
        prixCentimes: produit.prix_centimes,
        quantite: 1,
      })
    );
  }

  async function handleValider() {
    if (cart.length === 0) return;
    setEnvoiEnCours(true);
    setErreur(null);

    try {
      const res = await fetch("/api/commandes", {
        method: "POST",
        body: JSON.stringify({
          tableId: table.id,
          lignes: cart.map((item) => ({
            produitId: item.produitId,
            quantite: item.quantite,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error("La commande n'a pas pu être envoyée");
      }

      const { id } = (await res.json()) as { id: string };
      saveOrderId(table.slug, id);
      setDerniereCommandeId(id);
      setCart([]);
    } catch {
      setErreur("Impossible d'envoyer la commande. Vérifiez votre connexion et réessayez.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-28">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">
        Table {table.numero} — Commander
      </h1>

      <OrdersStatus tableSlug={table.slug} justPlacedOrderId={derniereCommandeId} />

      {categories.map((categorie) => {
        const produitsCategorie = produits.filter((p) => p.categorie_id === categorie.id);
        if (produitsCategorie.length === 0) return null;

        return (
          <section key={categorie.id} className="mt-8">
            <h2 className="font-display font-extrabold">
              {categorie.emoji} {categorie.nom}
            </h2>
            <ul className="mt-2 divide-y divide-cosy-pink/10">
              {produitsCategorie.map((produit) => (
                <li key={produit.id} className="flex items-center gap-4 py-3">
                  {produit.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={produit.photo_url}
                      alt={produit.nom}
                      className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{produit.nom}</p>
                    <p className="text-sm text-cosy-ink/60">{formatPrix(produit.prix_centimes)}</p>
                  </div>
                  <button
                    onClick={() => handleAjouter(produit)}
                    className="rounded-pill bg-cosy-pink px-4 py-2 text-sm font-bold text-white"
                  >
                    Ajouter
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-cosy-pink/20 bg-white p-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <ul className="text-sm">
              {cart.map((item) => (
                <li key={item.produitId} className="flex items-center gap-2">
                  <span>
                    {item.quantite} × {item.nom}
                  </span>
                  <button
                    onClick={() => setCart((c) => setQuantity(c, item.produitId, item.quantite - 1))}
                    aria-label={`Retirer un ${item.nom}`}
                    className="text-cosy-pink"
                  >
                    −
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={handleValider}
              disabled={envoiEnCours}
              className="rounded-pill bg-cosy-pink px-6 py-3 font-display font-extrabold text-white disabled:opacity-50"
            >
              {envoiEnCours ? "Envoi..." : `Commander · ${formatPrix(cartTotal(cart))}`}
            </button>
          </div>
          {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
        </div>
      )}

      <LoyaltyPopup />
    </div>
  );
}
