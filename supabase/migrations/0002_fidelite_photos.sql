-- Photos produits
alter table produits add column if not exists photo_url text;

-- Lien commande -> client (optionnel : la commande anonyme reste possible)
alter table commandes add column if not exists client_id uuid references auth.users(id);

-- Rôle personnel (staff) : accès admin/cuisine réservé aux membres de cette table
create table if not exists personnel (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

-- Paramètres du programme de fidélité (une seule ligne, modifiable en admin)
create table if not exists parametres_fidelite (
  id boolean primary key default true,
  points_requis integer not null default 10,
  montant_minimum_centimes integer not null default 500,
  valeur_bon_centimes integer not null default 1000,
  constraint parametres_fidelite_singleton check (id)
);
insert into parametres_fidelite (id) values (true) on conflict (id) do nothing;

-- Comptes de fidélité (un par client)
create table if not exists fidelite_comptes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  points integer not null default 0,
  solde_bons_centimes integer not null default 0,
  created_at timestamptz not null default now()
);

-- Historique des mouvements (traçabilité : achats qualifiants, bons accordés, ajustements manuels)
create table if not exists fidelite_mouvements (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references fidelite_comptes(id) on delete cascade,
  delta_points integer not null default 0,
  delta_solde_centimes integer not null default 0,
  motif text not null,
  commande_id uuid references commandes(id),
  cree_par uuid references personnel(id),
  created_at timestamptz not null default now()
);

-- RLS (idempotent : ré-activer une sécurité déjà active ne fait rien)
alter table personnel enable row level security;
alter table parametres_fidelite enable row level security;
alter table fidelite_comptes enable row level security;
alter table fidelite_mouvements enable row level security;

-- Politiques : on supprime d'abord si elles existent déjà, puis on les recrée
drop policy if exists "personnel_self_read" on personnel;
create policy "personnel_self_read" on personnel for select using (auth.uid() = id);

drop policy if exists "parametres_fidelite_public_read" on parametres_fidelite;
create policy "parametres_fidelite_public_read" on parametres_fidelite for select using (true);

drop policy if exists "fidelite_comptes_owner_read" on fidelite_comptes;
create policy "fidelite_comptes_owner_read" on fidelite_comptes for select using (auth.uid() = user_id);

drop policy if exists "fidelite_mouvements_owner_read" on fidelite_mouvements;
create policy "fidelite_mouvements_owner_read" on fidelite_mouvements for select using (
  exists (
    select 1 from fidelite_comptes c
    where c.id = fidelite_mouvements.compte_id and c.user_id = auth.uid()
  )
);
-- Aucune écriture publique sur personnel/parametres_fidelite/fidelite_comptes/fidelite_mouvements :
-- uniquement via les routes API (clé service role), comme le reste du projet.
