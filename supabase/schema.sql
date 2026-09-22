-- Extensions
create extension if not exists "pgcrypto";

-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  emoji text,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

-- Produits
create table produits (
  id uuid primary key default gen_random_uuid(),
  categorie_id uuid not null references categories(id) on delete cascade,
  nom text not null,
  description text not null default '',
  prix_centimes integer not null check (prix_centimes >= 0),
  disponible boolean not null default true,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

-- Tables (physical tables in the shop)
create table tables (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Commandes
create table commandes (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id),
  statut text not null default 'recue' check (statut in ('recue', 'en_preparation', 'prete')),
  created_at timestamptz not null default now()
);

-- Commande lignes (order line items)
create table commande_lignes (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes(id) on delete cascade,
  produit_id uuid not null references produits(id),
  nom_produit text not null,
  prix_unitaire_centimes integer not null check (prix_unitaire_centimes >= 0),
  quantite integer not null check (quantite > 0),
  created_at timestamptz not null default now()
);

-- Row Level Security: public read on everything, no public writes.
-- All writes happen through Next.js API routes using the service_role key,
-- which bypasses RLS entirely (server-side only, key never sent to the browser).

alter table categories enable row level security;
alter table produits enable row level security;
alter table tables enable row level security;
alter table commandes enable row level security;
alter table commande_lignes enable row level security;

create policy "categories_public_read" on categories for select using (true);
create policy "produits_public_read" on produits for select using (true);
create policy "tables_public_read" on tables for select using (true);
create policy "commandes_public_read" on commandes for select using (true);
create policy "commande_lignes_public_read" on commande_lignes for select using (true);

-- Photos produits
alter table produits add column photo_url text;

-- Lien commande -> client (optionnel : la commande anonyme reste possible)
alter table commandes add column client_id uuid references auth.users(id);

-- Rôle personnel (staff) : accès admin/cuisine réservé aux membres de cette table
create table personnel (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

-- Paramètres du programme de fidélité (une seule ligne, modifiable en admin)
create table parametres_fidelite (
  id boolean primary key default true,
  points_requis integer not null default 10,
  montant_minimum_centimes integer not null default 500,
  valeur_bon_centimes integer not null default 1000,
  constraint parametres_fidelite_singleton check (id)
);
insert into parametres_fidelite (id) values (true);

-- Comptes de fidélité (un par client)
create table fidelite_comptes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  points integer not null default 0,
  solde_bons_centimes integer not null default 0,
  created_at timestamptz not null default now()
);

-- Historique des mouvements (traçabilité : achats qualifiants, bons accordés, ajustements manuels)
create table fidelite_mouvements (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references fidelite_comptes(id) on delete cascade,
  delta_points integer not null default 0,
  delta_solde_centimes integer not null default 0,
  motif text not null,
  commande_id uuid references commandes(id),
  cree_par uuid references personnel(id),
  created_at timestamptz not null default now()
);

-- RLS
alter table personnel enable row level security;
alter table parametres_fidelite enable row level security;
alter table fidelite_comptes enable row level security;
alter table fidelite_mouvements enable row level security;

-- Un utilisateur connecté peut seulement vérifier SA PROPRE appartenance au personnel
-- (utilisé par le middleware et par lib/supabase/requireStaff.ts) — jamais la liste complète du staff.
create policy "personnel_self_read" on personnel for select using (auth.uid() = id);

-- Les paramètres de fidélité sont publics en lecture (affichés dans le pop-up)
create policy "parametres_fidelite_public_read" on parametres_fidelite for select using (true);

-- Un client ne voit que son propre compte / historique
create policy "fidelite_comptes_owner_read" on fidelite_comptes for select using (auth.uid() = user_id);
create policy "fidelite_mouvements_owner_read" on fidelite_mouvements for select using (
  exists (
    select 1 from fidelite_comptes c
    where c.id = fidelite_mouvements.compte_id and c.user_id = auth.uid()
  )
);
-- Aucune écriture publique sur personnel/parametres_fidelite/fidelite_comptes/fidelite_mouvements :
-- uniquement via les routes API (clé service role), comme le reste du projet.
