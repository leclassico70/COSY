export interface CompteFidelite {
  points: number;
  soldeBonsCentimes: number;
}

export interface ParametresFidelite {
  pointsRequis: number;
  montantMinimumCentimes: number;
  valeurBonCentimes: number;
}

export function commandeEstQualifiante(totalCentimes: number, parametres: ParametresFidelite): boolean {
  return totalCentimes >= parametres.montantMinimumCentimes;
}

export function appliquerPoints(
  compte: CompteFidelite,
  pointsAjoutes: number,
  parametres: ParametresFidelite
): CompteFidelite {
  let points = compte.points + pointsAjoutes;
  let soldeBonsCentimes = compte.soldeBonsCentimes;

  while (points >= parametres.pointsRequis) {
    points -= parametres.pointsRequis;
    soldeBonsCentimes += parametres.valeurBonCentimes;
  }

  return { points, soldeBonsCentimes };
}
