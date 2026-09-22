"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";
import { getOrderIds, saveOrderId } from "@/lib/orderSession";
import { statusLabel, type StatutCommande } from "@/lib/orderStatus";

interface Props {
  tableSlug: string;
  justPlacedOrderId: string | null;
}

interface CommandeSuivie {
  id: string;
  statut: StatutCommande;
}

export function OrdersStatus({ tableSlug, justPlacedOrderId }: Props) {
  const [commandes, setCommandes] = useState<CommandeSuivie[]>([]);

  useEffect(() => {
    if (justPlacedOrderId) {
      saveOrderId(tableSlug, justPlacedOrderId);
    }
  }, [justPlacedOrderId, tableSlug]);

  useEffect(() => {
    const orderIds = getOrderIds(tableSlug);
    if (orderIds.length === 0) return;

    const supabase = createSupabaseBrowserClient();

    supabase
      .from("commandes")
      .select("id, statut")
      .in("id", orderIds)
      .then(({ data }) => {
        if (data) setCommandes(data as CommandeSuivie[]);
      });

    const channel = supabase
      .channel(`commandes-${tableSlug}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          const updated = payload.new as CommandeSuivie;
          setCommandes((current) =>
            current.map((c) => (c.id === updated.id ? { ...c, statut: updated.statut } : c))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableSlug, justPlacedOrderId]);

  if (commandes.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-cosy-pink/20 bg-white p-4">
      <p className="font-display font-extrabold">Vos commandes</p>
      <ul className="mt-2 space-y-1 text-sm">
        {commandes.map((commande) => (
          <li key={commande.id} className="flex items-center justify-between">
            <span>Commande #{commande.id.slice(0, 8)}</span>
            <span className="font-semibold text-cosy-pink">{statusLabel(commande.statut)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
