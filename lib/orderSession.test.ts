import { describe, it, expect, beforeEach } from "vitest";
import { saveOrderId, getOrderIds } from "./orderSession";

describe("orderSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns an empty array when nothing was saved", () => {
    expect(getOrderIds("table-1")).toEqual([]);
  });

  it("saves and retrieves an order id for a table", () => {
    saveOrderId("table-1", "order-a");
    expect(getOrderIds("table-1")).toEqual(["order-a"]);
  });

  it("accumulates multiple order ids for the same table", () => {
    saveOrderId("table-1", "order-a");
    saveOrderId("table-1", "order-b");
    expect(getOrderIds("table-1")).toEqual(["order-a", "order-b"]);
  });

  it("keeps different tables separate", () => {
    saveOrderId("table-1", "order-a");
    saveOrderId("table-2", "order-b");
    expect(getOrderIds("table-1")).toEqual(["order-a"]);
    expect(getOrderIds("table-2")).toEqual(["order-b"]);
  });

  it("does not duplicate an id saved twice", () => {
    saveOrderId("table-1", "order-a");
    saveOrderId("table-1", "order-a");
    expect(getOrderIds("table-1")).toEqual(["order-a"]);
  });
});
