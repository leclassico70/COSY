import { describe, it, expect, vi, beforeEach } from "vitest";

const insertCommande = vi.fn();
const insertLignes = vi.fn();
const deleteCommande = vi.fn();
const selectProduits = vi.fn();
const selectParametres = vi.fn();
const selectCompte = vi.fn();
const insertCompte = vi.fn();
const updateCompte = vi.fn();
const insertMouvement = vi.fn();
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
      if (table === "parametres_fidelite") {
        return { select: selectParametres };
      }
      if (table === "fidelite_comptes") {
        return { select: selectCompte, insert: insertCompte, update: updateCompte };
      }
      if (table === "fidelite_mouvements") {
        return { insert: insertMouvement };
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

// Builds one call's worth of the `.update(...).eq().eq().eq().select().maybeSingle()` chain
// that the optimistic-concurrency update in crediterCompteAvecConcurrence produces.
function chaineUpdateCompte(maybeSingleData: { id: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: maybeSingleData, error: null });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eq3 = vi.fn().mockReturnValue({ select });
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  return { chaine: { eq: eq1 }, eq1, eq2, eq3, select, maybeSingle };
}

function mockUpdateCompteSucces() {
  const { chaine, eq1, eq2, eq3, select, maybeSingle } = chaineUpdateCompte({ id: "compte-1" });
  updateCompte.mockReturnValue(chaine);
  return { eq1, eq2, eq3, select, maybeSingle };
}

function mockParametres() {
  selectParametres.mockReturnValue({
    single: () =>
      Promise.resolve({
        data: { points_requis: 10, montant_minimum_centimes: 500, valeur_bon_centimes: 1000 },
        error: null,
      }),
  });
}

beforeEach(() => {
  insertCommande.mockReset();
  insertLignes.mockReset();
  deleteCommande.mockReset();
  selectProduits.mockReset();
  selectParametres.mockReset();
  selectCompte.mockReset();
  insertCompte.mockReset();
  updateCompte.mockReset();
  insertMouvement.mockReset();
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
    expect(selectCompte).not.toHaveBeenCalled();
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

  it("links the commande to the authenticated user but does not award a point below the minimum", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));
    mockParametres();

    const res = await POST(
      jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }) // 220 centimes, below 500
    );

    expect(res.status).toBe(201);
    expect(insertCommande).toHaveBeenCalledWith({ table_id: "t1", statut: "recue", client_id: "client-1" });
    expect(selectCompte).not.toHaveBeenCalled();
  });

  it("creates a fidelite account and awards the first point for a first-time qualifying customer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));
    mockProduits([{ id: "p1", nom: "Bagel Poulet", prix_centimes: 590, disponible: true }]);
    mockParametres();
    selectCompte.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
    });
    insertCompte.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({ data: { id: "compte-nouveau", points: 0, solde_bons_centimes: 0 }, error: null }),
      }),
    });
    const { eq1, eq2, eq3 } = mockUpdateCompteSucces();
    insertMouvement.mockResolvedValue({ error: null });

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(201);
    expect(insertCompte).toHaveBeenCalledWith({ user_id: "client-1" });
    expect(updateCompte).toHaveBeenCalledWith({ points: 1, solde_bons_centimes: 0 });
    expect(eq1).toHaveBeenCalledWith("id", "compte-nouveau");
    expect(eq2).toHaveBeenCalledWith("points", 0);
    expect(eq3).toHaveBeenCalledWith("solde_bons_centimes", 0);
    expect(insertMouvement).toHaveBeenCalledWith({
      compte_id: "compte-nouveau",
      delta_points: 1,
      delta_solde_centimes: 0,
      motif: "Commande qualifiante",
      commande_id: "cmd-1",
    });
  });

  it("awards a point to an existing account for a qualifying order", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));
    mockProduits([{ id: "p1", nom: "Bagel Poulet", prix_centimes: 590, disponible: true }]);
    mockParametres();
    selectCompte.mockReturnValue({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: { id: "compte-1", points: 3, solde_bons_centimes: 0 }, error: null }),
      }),
    });
    const { eq1, eq2, eq3 } = mockUpdateCompteSucces();
    insertMouvement.mockResolvedValue({ error: null });

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(201);
    expect(insertCompte).not.toHaveBeenCalled();
    expect(updateCompte).toHaveBeenCalledWith({ points: 4, solde_bons_centimes: 0 });
    expect(eq1).toHaveBeenCalledWith("id", "compte-1");
    expect(eq2).toHaveBeenCalledWith("points", 3);
    expect(eq3).toHaveBeenCalledWith("solde_bons_centimes", 0);
  });

  it("retries once and compounds the point when a concurrent order updated the account first", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));
    mockProduits([{ id: "p1", nom: "Bagel Poulet", prix_centimes: 590, disponible: true }]);
    mockParametres();

    // Initial read sees points: 3, but a concurrent order already bumped it to 5 by the
    // time our update runs — the first optimistic update must match zero rows.
    const eqLectureInitiale = vi.fn().mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({ data: { id: "compte-1", points: 3, solde_bons_centimes: 0 }, error: null }),
    });
    const eqRelecture = vi.fn().mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({ data: { id: "compte-1", points: 5, solde_bons_centimes: 0 }, error: null }),
    });
    selectCompte
      .mockReturnValueOnce({ eq: eqLectureInitiale })
      .mockReturnValueOnce({ eq: eqRelecture });

    const echec = chaineUpdateCompte(null);
    const succes = chaineUpdateCompte({ id: "compte-1" });
    updateCompte.mockReturnValueOnce(echec.chaine).mockReturnValueOnce(succes.chaine);
    insertMouvement.mockResolvedValue({ error: null });

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(201);
    expect(updateCompte).toHaveBeenCalledTimes(2);
    expect(updateCompte).toHaveBeenNthCalledWith(1, { points: 4, solde_bons_centimes: 0 });
    expect(echec.eq1).toHaveBeenCalledWith("id", "compte-1");
    expect(echec.eq2).toHaveBeenCalledWith("points", 3);
    expect(echec.eq3).toHaveBeenCalledWith("solde_bons_centimes", 0);
    expect(updateCompte).toHaveBeenNthCalledWith(2, { points: 6, solde_bons_centimes: 0 });
    expect(succes.eq1).toHaveBeenCalledWith("id", "compte-1");
    expect(succes.eq2).toHaveBeenCalledWith("points", 5);
    expect(succes.eq3).toHaveBeenCalledWith("solde_bons_centimes", 0);
    expect(insertMouvement).toHaveBeenCalledWith({
      compte_id: "compte-1",
      delta_points: 1,
      delta_solde_centimes: 0,
      motif: "Commande qualifiante",
      commande_id: "cmd-1",
    });
  });

  it("gives up gracefully (still 201, no mouvement recorded) when the update keeps conflicting", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));
    mockProduits([{ id: "p1", nom: "Bagel Poulet", prix_centimes: 590, disponible: true }]);
    mockParametres();

    const eqLectureInitiale = vi.fn().mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({ data: { id: "compte-1", points: 3, solde_bons_centimes: 0 }, error: null }),
    });
    const eqRelecture = vi.fn().mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({ data: { id: "compte-1", points: 5, solde_bons_centimes: 0 }, error: null }),
    });
    selectCompte
      .mockReturnValueOnce({ eq: eqLectureInitiale })
      .mockReturnValueOnce({ eq: eqRelecture });

    const echec1 = chaineUpdateCompte(null);
    const echec2 = chaineUpdateCompte(null);
    updateCompte.mockReturnValueOnce(echec1.chaine).mockReturnValueOnce(echec2.chaine);

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(201);
    expect(updateCompte).toHaveBeenCalledTimes(2);
    expect(insertMouvement).not.toHaveBeenCalled();
  });

  it("still returns 201 even if loyalty crediting fails unexpectedly", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));
    mockProduits([{ id: "p1", nom: "Bagel Poulet", prix_centimes: 590, disponible: true }]);
    selectParametres.mockReturnValue({ single: () => Promise.reject(new Error("db down")) });

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(201);
  });

  it("skips all fidelite writes when no parametres_fidelite row exists", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));
    mockProduits([{ id: "p1", nom: "Bagel Poulet", prix_centimes: 590, disponible: true }]);
    selectParametres.mockReturnValue({ single: () => Promise.resolve({ data: null, error: null }) });

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(201);
    expect(selectCompte).not.toHaveBeenCalled();
    expect(insertCompte).not.toHaveBeenCalled();
    expect(updateCompte).not.toHaveBeenCalled();
    expect(insertMouvement).not.toHaveBeenCalled();
  });

  it("issues a voucher (resets points, credits the solde) when the order crosses the points threshold", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    insertCommande.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }) }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));
    mockProduits([{ id: "p1", nom: "Bagel Poulet", prix_centimes: 590, disponible: true }]);
    mockParametres(); // points_requis: 10, valeur_bon_centimes: 1000
    selectCompte.mockReturnValue({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: { id: "compte-1", points: 9, solde_bons_centimes: 0 }, error: null }),
      }),
    });
    const { eq1, eq2, eq3 } = mockUpdateCompteSucces();
    insertMouvement.mockResolvedValue({ error: null });

    const res = await POST(jsonRequest({ tableId: "t1", lignes: [{ produitId: "p1", quantite: 1 }] }));

    expect(res.status).toBe(201);
    expect(updateCompte).toHaveBeenCalledWith({ points: 0, solde_bons_centimes: 1000 });
    expect(eq1).toHaveBeenCalledWith("id", "compte-1");
    expect(eq2).toHaveBeenCalledWith("points", 9);
    expect(eq3).toHaveBeenCalledWith("solde_bons_centimes", 0);
    expect(insertMouvement).toHaveBeenCalledWith({
      compte_id: "compte-1",
      delta_points: 1,
      delta_solde_centimes: 1000,
      motif: "Commande qualifiante",
      commande_id: "cmd-1",
    });
  });
});
