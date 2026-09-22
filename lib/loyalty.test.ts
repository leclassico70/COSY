import { describe, it, expect } from "vitest";
import { commandeEstQualifiante, appliquerPoints, type CompteFidelite, type ParametresFidelite } from "./loyalty";

const parametres: ParametresFidelite = {
  pointsRequis: 10,
  montantMinimumCentimes: 500,
  valeurBonCentimes: 1000,
};

describe("commandeEstQualifiante", () => {
  it("qualifies an order at or above the minimum", () => {
    expect(commandeEstQualifiante(500, parametres)).toBe(true);
    expect(commandeEstQualifiante(900, parametres)).toBe(true);
  });

  it("does not qualify an order below the minimum", () => {
    expect(commandeEstQualifiante(499, parametres)).toBe(false);
  });
});

describe("appliquerPoints", () => {
  it("adds points without crossing the threshold", () => {
    const compte: CompteFidelite = { points: 3, soldeBonsCentimes: 0 };
    expect(appliquerPoints(compte, 1, parametres)).toEqual({ points: 4, soldeBonsCentimes: 0 });
  });

  it("grants a voucher and resets points when the threshold is reached exactly", () => {
    const compte: CompteFidelite = { points: 9, soldeBonsCentimes: 0 };
    expect(appliquerPoints(compte, 1, parametres)).toEqual({ points: 0, soldeBonsCentimes: 1000 });
  });

  it("carries over remaining points past the threshold", () => {
    const compte: CompteFidelite = { points: 9, soldeBonsCentimes: 0 };
    expect(appliquerPoints(compte, 3, parametres)).toEqual({ points: 2, soldeBonsCentimes: 1000 });
  });

  it("can grant multiple vouchers in one jump", () => {
    const compte: CompteFidelite = { points: 8, soldeBonsCentimes: 500 };
    expect(appliquerPoints(compte, 22, parametres)).toEqual({ points: 0, soldeBonsCentimes: 3500 });
  });

  it("keeps an existing voucher balance untouched when adding non-qualifying points", () => {
    const compte: CompteFidelite = { points: 2, soldeBonsCentimes: 1000 };
    expect(appliquerPoints(compte, 1, parametres)).toEqual({ points: 3, soldeBonsCentimes: 1000 });
  });
});
