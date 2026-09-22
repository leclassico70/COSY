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
  photo_url: string | null;
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
  client_id: string | null;
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

export interface ParametresFidelite {
  id: boolean;
  points_requis: number;
  montant_minimum_centimes: number;
  valeur_bon_centimes: number;
}

export interface Personnel {
  id: string;
  nom: string;
  created_at: string;
}

export interface FideliteCompte {
  id: string;
  user_id: string;
  points: number;
  solde_bons_centimes: number;
  created_at: string;
}

export interface FideliteMouvement {
  id: string;
  compte_id: string;
  delta_points: number;
  delta_solde_centimes: number;
  motif: string;
  commande_id: string | null;
  cree_par: string | null;
  created_at: string;
}

// `interface` declarations (unlike `type` object literals) don't get an
// implicit string index signature in TypeScript, so a bare `Row: Categorie`
// fails to structurally satisfy postgrest-js's `GenericTable` (`Row: Record<string,
// unknown>`), which silently collapses every `.from(...)` result to `never`.
// Wrapping with this mapped type gives each Row an implicit index signature
// while leaving the named interfaces themselves untouched for other imports.
type TableRow<T> = { [K in keyof T]: T[K] };

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: TableRow<Categorie>;
        Insert: Partial<Categorie>;
        Update: Partial<Categorie>;
        Relationships: [];
      };
      produits: {
        Row: TableRow<Produit>;
        Insert: Partial<Produit>;
        Update: Partial<Produit>;
        Relationships: [];
      };
      tables: {
        Row: TableRow<TableRestaurant>;
        Insert: Partial<TableRestaurant>;
        Update: Partial<TableRestaurant>;
        Relationships: [];
      };
      commandes: {
        Row: TableRow<Commande>;
        Insert: Partial<Commande>;
        Update: Partial<Commande>;
        Relationships: [];
      };
      commande_lignes: {
        Row: TableRow<CommandeLigne>;
        Insert: Partial<CommandeLigne>;
        Update: Partial<CommandeLigne>;
        Relationships: [];
      };
      parametres_fidelite: {
        Row: TableRow<ParametresFidelite>;
        Insert: Partial<ParametresFidelite>;
        Update: Partial<ParametresFidelite>;
        Relationships: [];
      };
      personnel: {
        Row: TableRow<Personnel>;
        Insert: Partial<Personnel>;
        Update: Partial<Personnel>;
        Relationships: [];
      };
      fidelite_comptes: {
        Row: TableRow<FideliteCompte>;
        Insert: Partial<FideliteCompte>;
        Update: Partial<FideliteCompte>;
        Relationships: [];
      };
      fidelite_mouvements: {
        Row: TableRow<FideliteMouvement>;
        Insert: Partial<FideliteMouvement>;
        Update: Partial<FideliteMouvement>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
