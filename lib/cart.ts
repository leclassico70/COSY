export interface CartItem {
  produitId: string;
  nom: string;
  prixCentimes: number;
  quantite: number;
}

export function addItem(cart: CartItem[], item: CartItem): CartItem[] {
  const existing = cart.find((c) => c.produitId === item.produitId);
  if (!existing) return [...cart, item];
  return cart.map((c) =>
    c.produitId === item.produitId ? { ...c, quantite: c.quantite + item.quantite } : c
  );
}

export function removeItem(cart: CartItem[], produitId: string): CartItem[] {
  return cart.filter((c) => c.produitId !== produitId);
}

export function setQuantity(cart: CartItem[], produitId: string, quantite: number): CartItem[] {
  if (quantite <= 0) return removeItem(cart, produitId);
  return cart.map((c) => (c.produitId === produitId ? { ...c, quantite } : c));
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.prixCentimes * item.quantite, 0);
}
