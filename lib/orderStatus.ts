export type StatutCommande = "recue" | "en_preparation" | "prete";

const ORDER: StatutCommande[] = ["recue", "en_preparation", "prete"];

export function nextStatus(current: StatutCommande): StatutCommande | null {
  const index = ORDER.indexOf(current);
  const next = ORDER[index + 1];
  return next ?? null;
}

const LABELS: Record<StatutCommande, string> = {
  recue: "Reçue",
  en_preparation: "En préparation",
  prete: "Prête",
};

export function statusLabel(statut: StatutCommande): string {
  return LABELS[statut];
}
