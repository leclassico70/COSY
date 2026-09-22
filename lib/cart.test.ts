import { describe, it, expect } from "vitest";
import { addItem, removeItem, setQuantity, cartTotal, type CartItem } from "./cart";

const donut: CartItem = { produitId: "p1", nom: "Donut Classic", prixCentimes: 220, quantite: 1 };
const bagel: CartItem = { produitId: "p2", nom: "Bagel Poulet", prixCentimes: 590, quantite: 1 };

describe("addItem", () => {
  it("adds a new product to an empty cart", () => {
    expect(addItem([], donut)).toEqual([donut]);
  });

  it("increments quantity if the product is already in the cart", () => {
    const result = addItem([donut], donut);
    expect(result).toEqual([{ ...donut, quantite: 2 }]);
  });

  it("keeps other items untouched when adding a different product", () => {
    const result = addItem([donut], bagel);
    expect(result).toEqual([donut, bagel]);
  });
});

describe("removeItem", () => {
  it("removes the matching product entirely", () => {
    expect(removeItem([donut, bagel], "p1")).toEqual([bagel]);
  });

  it("is a no-op if the product isn't in the cart", () => {
    expect(removeItem([donut], "unknown")).toEqual([donut]);
  });
});

describe("setQuantity", () => {
  it("updates the quantity of a matching product", () => {
    expect(setQuantity([donut], "p1", 3)).toEqual([{ ...donut, quantite: 3 }]);
  });

  it("removes the item when quantity is set to 0", () => {
    expect(setQuantity([donut, bagel], "p1", 0)).toEqual([bagel]);
  });
});

describe("cartTotal", () => {
  it("sums price * quantity across items", () => {
    expect(cartTotal([donut, { ...bagel, quantite: 2 }])).toBe(220 + 590 * 2);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartTotal([])).toBe(0);
  });
});
