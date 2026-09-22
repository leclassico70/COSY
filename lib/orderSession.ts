function storageKey(tableSlug: string): string {
  return `cosy:commandes:${tableSlug}`;
}

export function getOrderIds(tableSlug: string): string[] {
  const raw = sessionStorage.getItem(storageKey(tableSlug));
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

export function saveOrderId(tableSlug: string, orderId: string): void {
  const existing = getOrderIds(tableSlug);
  if (existing.includes(orderId)) return;
  sessionStorage.setItem(storageKey(tableSlug), JSON.stringify([...existing, orderId]));
}
