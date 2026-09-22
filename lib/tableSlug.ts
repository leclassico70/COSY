export function slugForTable(numero: number): string {
  return `table-${numero}`;
}

export function buildTableOrderUrl(baseUrl: string, slug: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/commander/${slug}`;
}
