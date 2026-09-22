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
