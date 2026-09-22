import { describe, it, expect } from "vitest";
import { nextStatus, statusLabel, type StatutCommande } from "./orderStatus";

describe("nextStatus", () => {
  it("moves from recue to en_preparation", () => {
    expect(nextStatus("recue")).toBe("en_preparation");
  });

  it("moves from en_preparation to prete", () => {
    expect(nextStatus("en_preparation")).toBe("prete");
  });

  it("returns null when already prete (no further transition)", () => {
    expect(nextStatus("prete")).toBeNull();
  });
});

describe("statusLabel", () => {
  it.each([
    ["recue", "Reçue"],
    ["en_preparation", "En préparation"],
    ["prete", "Prête"],
  ] as [StatutCommande, string][])("labels %s as %s", (statut, label) => {
    expect(statusLabel(statut)).toBe(label);
  });
});
