import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const update = vi.fn();
const eq = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser },
  }),
}));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq };
      },
    }),
  }),
}));

import { PATCH } from "./route";

beforeEach(() => {
  getUser.mockReset();
  update.mockReset();
  eq.mockReset();
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/commandes/cmd-1/statut", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/commandes/[id]/statut", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await PATCH(jsonRequest({ statut: "en_preparation" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid status value", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });

    const res = await PATCH(jsonRequest({ statut: "pas_un_statut" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(400);
  });

  it("updates the status when authenticated with a valid status", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });
    eq.mockResolvedValue({ error: null });

    const res = await PATCH(jsonRequest({ statut: "en_preparation" }), {
      params: Promise.resolve({ id: "cmd-1" }),
    });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ statut: "en_preparation" });
    expect(eq).toHaveBeenCalledWith("id", "cmd-1");
  });
});
