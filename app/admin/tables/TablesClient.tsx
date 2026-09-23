"use client";

import { useState } from "react";
import type { TableRestaurant } from "@/lib/supabase/types";

interface Props {
  tablesAvecQr: { table: TableRestaurant; qrDataUrl: string }[];
}

export function TablesClient({ tablesAvecQr: initial }: Props) {
  const [tablesAvecQr] = useState(initial);
  const [numero, setNumero] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleCreer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const numeroInt = parseInt(numero, 10);
    if (!numeroInt) return;

    const reponse = await fetch("/api/admin/tables", {
      method: "POST",
      body: JSON.stringify({ numero: numeroInt }),
    });

    if (!reponse.ok) {
      setErreur("Impossible de créer cette table (numéro déjà utilisé ?).");
      return;
    }

    setNumero("");
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 print:py-0">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink print:hidden">
        Tables &amp; QR codes
      </h1>

      <form onSubmit={handleCreer} className="mt-6 flex gap-2 print:hidden">
        <input
          type="number"
          placeholder="Numéro de table"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          className="rounded border border-cosy-ink/20 px-3 py-2"
        />
        <button type="submit" className="rounded-pill bg-cosy-pink px-4 py-2 font-bold text-white">
          Créer
        </button>
      </form>
      {erreur && <p className="mt-2 text-sm text-red-600 print:hidden">{erreur}</p>}

      <button
        onClick={() => window.print()}
        className="mt-4 rounded-pill border border-cosy-pink px-4 py-2 font-bold text-cosy-pink print:hidden"
      >
        Imprimer tous les QR codes
      </button>

      <div className="mt-8 grid grid-cols-2 gap-6 print:grid-cols-1">
        {tablesAvecQr.map(({ table, qrDataUrl }) => (
          <div key={table.id} className="rounded-lg border border-cosy-pink/20 p-4 text-center">
            <p className="font-display font-extrabold">Table {table.numero}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR code table ${table.numero}`} className="mx-auto mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
