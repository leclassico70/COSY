import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireStaff } = vi.hoisted(() => ({ requireStaff: vi.fn() }));
const insert = vi.fn();

vi.mock("@/lib/supabase/requireStaff", () => ({ requireStaff }));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({ from: () => ({ insert }) }),
}));

import { POST } from "./route";

beforeEach(() => {
  requireStaff.mockReset();
  insert.mockReset();
});

describe("POST /api/admin/categories", () => {
  it("returns 401 when the caller is not staff", async () => {
    requireStaff.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ nom: "Bagels", ordre: 1 }) })
    );
    expect(res.status).toBe(401);
  });

  it("inserts the category when the caller is staff", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    insert.mockResolvedValue({ error: null });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ nom: "Bagels", emoji: "🥯", ordre: 1 }),
      })
    );

    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ nom: "Bagels", emoji: "🥯", ordre: 1 });
  });

  it("returns 400 when nom is missing", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });

    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ nom: "  ", ordre: 1 }) })
    );

    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});
