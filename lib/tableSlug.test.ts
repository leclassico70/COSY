import { describe, it, expect } from "vitest";
import { slugForTable, buildTableOrderUrl } from "./tableSlug";

describe("slugForTable", () => {
  it("builds a slug from a table number", () => {
    expect(slugForTable(7)).toBe("table-7");
  });

  it("pads nothing — numbers stay as-is", () => {
    expect(slugForTable(12)).toBe("table-12");
  });
});

describe("buildTableOrderUrl", () => {
  it("joins the base URL with the commander path and slug", () => {
    expect(buildTableOrderUrl("https://cosy-montbeliard.fr", "table-7")).toBe(
      "https://cosy-montbeliard.fr/commander/table-7"
    );
  });

  it("strips a trailing slash from the base URL", () => {
    expect(buildTableOrderUrl("https://cosy-montbeliard.fr/", "table-7")).toBe(
      "https://cosy-montbeliard.fr/commander/table-7"
    );
  });
});
