"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";
import { nextStatus, statusLabel } from "@/lib/orderStatus";
import type { Commande, CommandeLigne, TableRestaurant } from "@/lib/supabase/types";

interface Props {
  commandesInitiales: Commande[];
  lignes: CommandeLigne[];
  tables: TableRestaurant[];
}

export function CuisineClient({ commandesInitiales, lignes, tables }: Props) {
  const [commandes, setCommandes] = useState(commandesInitiales);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel("cuisine-commandes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commandes" },
        (payload) => {
          setCommandes((current) => [...current, payload.new as Commande]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          const updated = payload.new as Commande;
          setCommandes((current) =>
            updated.statut === "prete"
              ? current.filter((c) => c.id !== updated.id)
              : current.map((c) => (c.id === updated.id ? updated : c))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleAvancer(commande: Commande) {
    const next = nextStatus(commande.statut);
    if (!next) return;

    await fetch(`/api/commandes/${commande.id}/statut`, {
      method: "PATCH",
      body: JSON.stringify({ statut: next }),
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Cuisine</h1>

      <div className="mt-6 space-y-4">
        {commandes.map((commande) => {
          const table = tables.find((t) => t.id === commande.table_id);
          const lignesCommande = lignes.filter((l) => l.commande_id === commande.id);

          return (
            <div key={commande.id} className="rounded-lg border border-cosy-pink/20 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-display font-extrabold">
                  Table {table?.numero ?? "?"} — {statusLabel(commande.statut)}
                </p>
                <button
                  onClick={() => handleAvancer(commande)}
                  className="rounded-pill bg-cosy-pink px-4 py-2 text-sm font-bold text-white"
                >
                  {commande.statut === "recue" ? "Démarrer" : "Marquer prête"}
                </button>
              </div>
              <ul className="mt-2 text-sm text-cosy-ink/70">
                {lignesCommande.map((ligne) => (
                  <li key={ligne.id}>
                    {ligne.quantite} × {ligne.nom_produit}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {commandes.length === 0 && <p className="text-cosy-ink/50">Aucune commande en cours.</p>}
      </div>
    </div>
  );
}
