import { describe, it, expect } from "vitest";
import { formatPrix } from "./money";

describe("formatPrix", () => {
  it("formats whole euros with two decimals", () => {
    expect(formatPrix(500)).toBe("5,00 €");
  });

  it("formats cents with a comma separator", () => {
    expect(formatPrix(590)).toBe("5,90 €");
  });

  it("formats amounts under one euro", () => {
    expect(formatPrix(220)).toBe("2,20 €");
  });

  it("formats zero", () => {
    expect(formatPrix(0)).toBe("0,00 €");
  });
});
