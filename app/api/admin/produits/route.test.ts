import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireStaff } = vi.hoisted(() => ({ requireStaff: vi.fn() }));
const insert = vi.fn();
const update = vi.fn();
const eqUpdate = vi.fn();
const del = vi.fn();
const eqDelete = vi.fn();

vi.mock("@/lib/supabase/requireStaff", () => ({ requireStaff }));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({
      insert,
      update: (values: unknown) => {
        update(values);
        return { eq: eqUpdate };
      },
      delete: () => {
        del();
        return { eq: eqDelete };
      },
    }),
  }),
}));

import { POST, PATCH, DELETE } from "./route";

beforeEach(() => {
  requireStaff.mockReset();
  insert.mockReset();
  update.mockReset();
  eqUpdate.mockReset();
  del.mockReset();
  eqDelete.mockReset();
});

function req(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/produits", { method, body: JSON.stringify(body) });
}

describe("/api/admin/produits", () => {
  it("POST returns 401 when the caller is not staff", async () => {
    requireStaff.mockResolvedValue(null);
    const res = await POST(req("POST", { nom: "Donut" }));
    expect(res.status).toBe(401);
  });

  it("POST inserts the product when the caller is staff", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    insert.mockResolvedValue({ error: null });

    const res = await POST(
      req("POST", {
        categorieId: "cat-1",
        nom: "Donut Classic",
        description: "Parfums divers",
        prixCentimes: 220,
        photoUrl: null,
      })
    );

    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      categorie_id: "cat-1",
      nom: "Donut Classic",
      description: "Parfums divers",
      prix_centimes: 220,
      photo_url: null,
      disponible: true,
    });
  });

  it("POST returns 400 when nom is missing", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });

    const res = await POST(
      req("POST", { categorieId: "cat-1", nom: "  ", description: "", prixCentimes: 220 })
    );

    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("POST returns 400 when prixCentimes is negative", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });

    const res = await POST(
      req("POST", { categorieId: "cat-1", nom: "Donut Classic", description: "", prixCentimes: -1 })
    );

    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("PATCH updates fields for a given product id", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    eqUpdate.mockResolvedValue({ error: null });

    const res = await PATCH(req("PATCH", { id: "p1", disponible: false }));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ disponible: false });
    expect(eqUpdate).toHaveBeenCalledWith("id", "p1");
  });

  it("DELETE removes a product by id", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    eqDelete.mockResolvedValue({ error: null });

    const res = await DELETE(req("DELETE", { id: "p1" }));

    expect(res.status).toBe(200);
    expect(eqDelete).toHaveBeenCalledWith("id", "p1");
  });
});
