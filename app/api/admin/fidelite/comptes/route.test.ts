import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireStaff } = vi.hoisted(() => ({ requireStaff: vi.fn() }));
const listUsers = vi.fn();
const selectCompte = vi.fn();
const insertCompte = vi.fn();
const updateCompte = vi.fn();
const insertMouvement = vi.fn();

vi.mock("@/lib/supabase/requireStaff", () => ({ requireStaff }));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    auth: { admin: { listUsers } },
    from: (table: string) => {
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

import { GET, PATCH } from "./route";

beforeEach(() => {
  requireStaff.mockReset();
  listUsers.mockReset();
  selectCompte.mockReset();
  insertCompte.mockReset();
  updateCompte.mockReset();
  insertMouvement.mockReset();
});

describe("GET /api/admin/fidelite/comptes", () => {
  it("returns 401 when the caller is not staff", async () => {
    requireStaff.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost?email=a@b.com"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when email is missing", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no account matches the email", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    const res = await GET(new Request("http://localhost?email=a@b.com"));
    expect(res.status).toBe(404);
  });

  it("returns the account balance, defaulting to 0 for a customer with no fidelite row yet", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    listUsers.mockResolvedValue({
      data: { users: [{ id: "client-1", email: "a@b.com" }] },
      error: null,
    });
    selectCompte.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
    });

    const res = await GET(new Request("http://localhost?email=a@b.com"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ userId: "client-1", email: "a@b.com", points: 0, soldeBonsCentimes: 0 });
  });
});

describe("PATCH /api/admin/fidelite/comptes", () => {
  function req(body: unknown) {
    return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
  }

  it("returns 401 when the caller is not staff", async () => {
    requireStaff.mockResolvedValue(null);
    const res = await PATCH(req({ userId: "client-1", deltaPoints: 1, motif: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when motif is missing", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    const res = await PATCH(req({ userId: "client-1", deltaPoints: 1 }));
    expect(res.status).toBe(400);
  });

  it("credits an existing account and records the movement with the staff id", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    selectCompte.mockReturnValue({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: { id: "compte-1", points: 2, solde_bons_centimes: 500 }, error: null }),
      }),
    });
    const eqUpdate = vi.fn().mockResolvedValue({ error: null });
    updateCompte.mockReturnValue({ eq: eqUpdate });
    insertMouvement.mockResolvedValue({ error: null });

    const res = await PATCH(
      req({ userId: "client-1", deltaPoints: 0, deltaSoldeCentimes: 1000, motif: "Bon utilisé en caisse" })
    );

    expect(res.status).toBe(200);
    expect(updateCompte).toHaveBeenCalledWith({ points: 2, solde_bons_centimes: 1500 });
    expect(insertMouvement).toHaveBeenCalledWith({
      compte_id: "compte-1",
      delta_points: 0,
      delta_solde_centimes: 1000,
      motif: "Bon utilisé en caisse",
      cree_par: "staff-1",
    });
  });

  it("creates an account first when the customer has none yet", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    selectCompte.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
    });
    insertCompte.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({ data: { id: "compte-nouveau", points: 0, solde_bons_centimes: 0 }, error: null }),
      }),
    });
    const eqUpdate = vi.fn().mockResolvedValue({ error: null });
    updateCompte.mockReturnValue({ eq: eqUpdate });
    insertMouvement.mockResolvedValue({ error: null });

    const res = await PATCH(req({ userId: "client-1", deltaPoints: 1, motif: "Geste commercial" }));

    expect(res.status).toBe(200);
    expect(insertCompte).toHaveBeenCalledWith({ user_id: "client-1" });
    expect(updateCompte).toHaveBeenCalledWith({ points: 1, solde_bons_centimes: 0 });
  });

  it("clamps the balance at zero instead of going negative, and logs the actually-applied delta", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    selectCompte.mockReturnValue({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: { id: "compte-1", points: 2, solde_bons_centimes: 300 }, error: null }),
      }),
    });
    const eqUpdate = vi.fn().mockResolvedValue({ error: null });
    updateCompte.mockReturnValue({ eq: eqUpdate });
    insertMouvement.mockResolvedValue({ error: null });

    const res = await PATCH(
      req({ userId: "client-1", deltaPoints: -5, deltaSoldeCentimes: -9999, motif: "Correction" })
    );

    expect(res.status).toBe(200);
    expect(updateCompte).toHaveBeenCalledWith({ points: 0, solde_bons_centimes: 0 });
    expect(insertMouvement).toHaveBeenCalledWith({
      compte_id: "compte-1",
      delta_points: -2,
      delta_solde_centimes: -300,
      motif: "Correction",
      cree_par: "staff-1",
    });
  });
});
