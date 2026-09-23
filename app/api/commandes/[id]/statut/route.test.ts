import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireStaff } = vi.hoisted(() => ({ requireStaff: vi.fn() }));
const selectCommande = vi.fn();
const updateCommande = vi.fn();
const selectLignes = vi.fn();
const selectParametres = vi.fn();
const selectCompte = vi.fn();
const insertCompte = vi.fn();
const updateCompte = vi.fn();
const insertMouvement = vi.fn();

vi.mock("@/lib/supabase/requireStaff", () => ({
  requireStaff,
}));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === "commandes") {
        return { select: selectCommande, update: updateCommande };
      }
      if (table === "commande_lignes") {
        return { select: selectLignes };
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

import { PATCH } from "./route";

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
  const { chaine } = chaineUpdateCompte({ id: "compte-1" });
  updateCompte.mockReturnValue(chaine);
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

function mockCommandeAvant(data: { statut: string; client_id: string | null } | null) {
  selectCommande.mockReturnValue({
    eq: () => ({ maybeSingle: () => Promise.resolve({ data, error: null }) }),
  });
}

function mockLignes(lignes: { prix_unitaire_centimes: number; quantite: number }[]) {
  selectLignes.mockReturnValue({ eq: () => Promise.resolve({ data: lignes, error: null }) });
}

beforeEach(() => {
  requireStaff.mockReset();
  selectCommande.mockReset();
  updateCommande.mockReset();
  selectLignes.mockReset();
  selectParametres.mockReset();
  selectCompte.mockReset();
  insertCompte.mockReset();
  updateCompte.mockReset();
  insertMouvement.mockReset();

  updateCommande.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/commandes/cmd-1/statut", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/commandes/[id]/statut", () => {
  it("returns 401 when the caller is not staff", async () => {
    requireStaff.mockResolvedValue(null);

    const res = await PATCH(jsonRequest({ statut: "en_preparation" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid status value", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });

    const res = await PATCH(jsonRequest({ statut: "pas_un_statut" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the commande does not exist", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    mockCommandeAvant(null);

    const res = await PATCH(jsonRequest({ statut: "en_preparation" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(404);
  });

  it("updates the status without touching fidelite when moving to en_preparation", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    mockCommandeAvant({ statut: "recue", client_id: "client-1" });

    const res = await PATCH(jsonRequest({ statut: "en_preparation" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(200);
    expect(updateCommande).toHaveBeenCalledWith({ statut: "en_preparation" });
    expect(selectLignes).not.toHaveBeenCalled();
  });

  it("does not award a point when the order has no client_id (anonymous order)", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    mockCommandeAvant({ statut: "en_preparation", client_id: null });

    const res = await PATCH(jsonRequest({ statut: "prete" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(200);
    expect(selectLignes).not.toHaveBeenCalled();
  });

  it("does not re-award a point when the order was already prete", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    mockCommandeAvant({ statut: "prete", client_id: "client-1" });

    const res = await PATCH(jsonRequest({ statut: "prete" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(200);
    expect(selectLignes).not.toHaveBeenCalled();
  });

  it("does not award a point below the qualifying minimum", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    mockCommandeAvant({ statut: "en_preparation", client_id: "client-1" });
    mockLignes([{ prix_unitaire_centimes: 220, quantite: 1 }]); // 220 centimes, below 500
    mockParametres();

    const res = await PATCH(jsonRequest({ statut: "prete" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(200);
    expect(selectCompte).not.toHaveBeenCalled();
  });

  it("awards a point when the order is marked prete for the first time and qualifies", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    mockCommandeAvant({ statut: "en_preparation", client_id: "client-1" });
    mockLignes([{ prix_unitaire_centimes: 590, quantite: 1 }]);
    mockParametres();
    selectCompte.mockReturnValue({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: { id: "compte-1", points: 3, solde_bons_centimes: 0 }, error: null }),
      }),
    });
    mockUpdateCompteSucces();
    insertMouvement.mockResolvedValue({ error: null });

    const res = await PATCH(jsonRequest({ statut: "prete" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(200);
    expect(updateCommande).toHaveBeenCalledWith({ statut: "prete" });
    expect(updateCompte).toHaveBeenCalledWith({ points: 4, solde_bons_centimes: 0 });
    expect(insertMouvement).toHaveBeenCalledWith({
      compte_id: "compte-1",
      delta_points: 1,
      delta_solde_centimes: 0,
      motif: "Commande qualifiante",
      commande_id: "cmd-1",
    });
  });

  it("still returns 200 even if loyalty crediting fails unexpectedly", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    mockCommandeAvant({ statut: "en_preparation", client_id: "client-1" });
    mockLignes([{ prix_unitaire_centimes: 590, quantite: 1 }]);
    selectParametres.mockReturnValue({ single: () => Promise.reject(new Error("db down")) });

    const res = await PATCH(jsonRequest({ statut: "prete" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(200);
  });
});
