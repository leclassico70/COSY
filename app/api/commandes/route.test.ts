import { describe, it, expect, vi, beforeEach } from "vitest";

const insertCommande = vi.fn();
const insertLignes = vi.fn();
const deleteCommande = vi.fn();
const selectProduits = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
  }),
}));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === "commandes") {
        return { insert: insertCommande, delete: deleteCommande };
      }
      if (table === "commande_lignes") {
        return { insert: insertLignes };
      }
      if (table === "produits") {
        return { select: selectProduits };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

interface ProduitStub {
  id: string;
  nom: string;
  prix_centimes: number;
  disponible: boolean;
}

function mockProduits(produits: ProduitStub[]) {
  selectProduits.mockReturnValue({
    in: vi.fn().mockResolvedValue({ data: produits, error: null }),
  });
}

beforeEach(() => {
  insertCommande.mockReset();
  insertLignes.mockReset();
  deleteCommande.mockReset();
  selectProduits.mockReset();
  getUser.mockReset();

  getUser.mockResolvedValue({ data: { user: null } });
  deleteCommande.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  mockProduits([{ id: "p1", nom: "Donut Classic", prix_centimes: 220, disponible: true }]);
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

  it("returns 400 when lignes is not an array", async () => {
    const res = await POST(jsonRequest({ tableId: "t1", lignes: "oops" }));
    expect(res.status).toBe(400);
  });

  it("creates an anonymous commande (no client_id) when nobody is logged in", async () => {
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));

    const res = await POST(
      jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 2 }] })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: "cmd-1" });
    expect(insertCommande).toHaveBeenCalledWith({ table_id: "t1", statut: "recue", client_id: null });
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

  it("links the commande to the authenticated user's client_id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(201);
    expect(insertCommande).toHaveBeenCalledWith({ table_id: "t1", statut: "recue", client_id: "client-1" });
  });

  it("returns 400 when a produitId does not exist", async () => {
    mockProduits([]);
    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "inconnu", quantite: 1 }] }));
    expect(res.status).toBe(400);
    expect(insertCommande).not.toHaveBeenCalled();
  });

  it("returns 400 when a produitId is marked unavailable", async () => {
    mockProduits([{ id: "p1", nom: "Donut Classic", prix_centimes: 220, disponible: false }]);
    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));
    expect(res.status).toBe(400);
    expect(insertCommande).not.toHaveBeenCalled();
  });

  it("returns 500 when the produits lookup fails", async () => {
    selectProduits.mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } }),
    });
    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));
    expect(res.status).toBe(500);
    expect(insertCommande).not.toHaveBeenCalled();
  });

  it("returns 500 when the commande insert fails", async () => {
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: "db error" } }) }),
    });
    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));
    expect(res.status).toBe(500);
  });

  it("deletes the orphaned commande when the lignes insert fails", async () => {
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: { message: "db error" } }));
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    deleteCommande.mockReturnValue({ eq: eqMock });

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(500);
    expect(deleteCommande).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", "cmd-1");
  });
});
