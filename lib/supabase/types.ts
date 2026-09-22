export type StatutCommande = "recue" | "en_preparation" | "prete";

export interface Categorie {
  id: string;
  nom: string;
  emoji: string | null;
  ordre: number;
  created_at: string;
}

export interface Produit {
  id: string;
  categorie_id: string;
  nom: string;
  description: string;
  prix_centimes: number;
  disponible: boolean;
  ordre: number;
  created_at: string;
}

export interface TableRestaurant {
  id: string;
  numero: number;
  slug: string;
  created_at: string;
}

export interface Commande {
  id: string;
  table_id: string;
  statut: StatutCommande;
  created_at: string;
}

export interface CommandeLigne {
  id: string;
  commande_id: string;
  produit_id: string;
  nom_produit: string;
  prix_unitaire_centimes: number;
  quantite: number;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      categories: { Row: Categorie; Insert: Partial<Categorie>; Update: Partial<Categorie> };
      produits: { Row: Produit; Insert: Partial<Produit>; Update: Partial<Produit> };
      tables: { Row: TableRestaurant; Insert: Partial<TableRestaurant>; Update: Partial<TableRestaurant> };
      commandes: { Row: Commande; Insert: Partial<Commande>; Update: Partial<Commande> };
      commande_lignes: { Row: CommandeLigne; Insert: Partial<CommandeLigne>; Update: Partial<CommandeLigne> };
    };
  };
}
