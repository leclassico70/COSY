import QRCode from "qrcode";

export async function generateQrCodeDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 320 });
}
