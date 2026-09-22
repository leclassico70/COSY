export function formatPrix(centimes: number): string {
  const euros = centimes / 100;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}
