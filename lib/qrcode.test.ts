import { describe, it, expect } from "vitest";
import { generateQrCodeDataUrl } from "./qrcode";

describe("generateQrCodeDataUrl", () => {
  it("returns a PNG data URL", async () => {
    const dataUrl = await generateQrCodeDataUrl("https://cosy-montbeliard.fr/commander/table-7");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
