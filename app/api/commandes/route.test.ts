import { describe, it, expect, vi, beforeEach } from "vitest";

const insertCommande = vi.fn();
const insertLignes = vi.fn();

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === "commandes") {
        return {
          insert: insertCommande,
        };
      }
      if (table === "commande_lignes") {
        return {
          insert: insertLignes,
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  insertCommande.mockReset();
  insertLignes.mockReset();
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/commandes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/commandes", () => {
  it("returns 400 when tableId is missing", async () => {
    const res = await POST(jsonRequest({ lignes: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lignes is empty", async () => {
    const res = await POST(jsonRequest({ tableId: "t1", lignes: [] }));
    expect(res.status).toBe(400);
  });

  it("creates the commande then its lignes, and returns the new id", async () => {
    insertCommande.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }),
      }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));

    const res = await POST(
      jsonRequest({
        tableId: "t1",
        lignes: [{ produitId: "p1", nom: "Donut Classic", prixCentimes: 220, quantite: 2 }],
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: "cmd-1" });
    expect(insertCommande).toHaveBeenCalledWith({ table_id: "t1", statut: "recue" });
    expect(insertLignes).toHaveBeenCalledWith([
      {
        commande_id: "cmd-1",
        produit_id: "p1",
        nom_produit: "Donut Classic",
        prix_unitaire_centimes: 220,
        quantite: 2,
      },
    ]);
  });

  it("returns 500 when the commande insert fails", async () => {
    insertCommande.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: { message: "db error" } }),
      }),
    });

    const res = await POST(
      jsonRequest({
        tableId: "t1",
        lignes: [{ produitId: "p1", nom: "Donut Classic", prixCentimes: 220, quantite: 1 }],
      })
    );

    expect(res.status).toBe(500);
  });
});
