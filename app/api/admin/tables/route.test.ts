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

describe("POST /api/admin/tables", () => {
  it("builds the slug from the table number", async () => {
    requireStaff.mockResolvedValue({ id: "staff-1", nom: "Alex" });
    insert.mockResolvedValue({ error: null });

    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ numero: 7 }) })
    );

    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ numero: 7, slug: "table-7" });
  });
});
