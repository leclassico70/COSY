# Site web Cosy Montbéliard + commande à table QR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js + Supabase web app that serves as Cosy Café & Cie's public website (Accueil, Menu, Contact) and its table-ordering system (customer QR-code ordering, real-time kitchen screen, and an admin panel for menu and table/QR management).

**Architecture:** A single Next.js (App Router, TypeScript) project talks to a Supabase Postgres database. Public read data (categories, produits) is fetched directly by browser/server components via the Supabase anon key under row-level-security (RLS) policies that allow public `SELECT`. All writes (order creation, status changes, menu edits) go through Next.js API routes that use a server-only Supabase **service role** key, so RLS never needs to grant anonymous writes. Real-time updates (kitchen screen, customer order status) use Supabase Realtime, subscribing directly from the browser under the same public-`SELECT` RLS policies.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, Supabase (Postgres + Auth + Realtime), `@supabase/supabase-js`, `@supabase/ssr`, `qrcode` (QR image generation), Vitest + Testing Library (unit tests), npm.

---

## File Structure

```
website/
├── app/
│   ├── layout.tsx                            — root layout: <html>, fonts, Header/Footer, globals.css
│   ├── globals.css                            — Tailwind directives + brand color tokens (Pop & Gourmand)
│   ├── page.tsx                                — Accueil
│   ├── menu/page.tsx                           — Menu public (lecture seule, fetch Supabase)
│   ├── contact/page.tsx                        — Contact & horaires (contenu statique)
│   ├── commander/[slug]/page.tsx               — Page de commande à table (server component: résout la table par slug)
│   ├── commander/[slug]/CommandeClient.tsx     — Client component: catégories/produits, panier, envoi, suivi temps réel
│   ├── cuisine/page.tsx                        — Écran cuisine (server component, vérifie l'auth puis rend le client component)
│   ├── cuisine/CuisineClient.tsx               — Client component: liste temps réel des commandes + boutons de statut
│   ├── admin/login/page.tsx                    — Connexion (email/mot de passe Supabase Auth)
│   ├── admin/page.tsx                          — Tableau de bord admin (liens)
│   ├── admin/produits/page.tsx                 — Server component: charge produits/catégories
│   ├── admin/produits/ProduitsClient.tsx       — Client component: formulaires CRUD produits/catégories
│   ├── admin/tables/page.tsx                   — Server component: charge les tables
│   ├── admin/tables/TablesClient.tsx           — Client component: créer une table, afficher/imprimer son QR code
│   └── api/
│       ├── commandes/route.ts                  — POST: créer une commande (public, pas d'auth)
│       ├── commandes/[id]/statut/route.ts      — PATCH: changer le statut d'une commande (auth requise)
│       └── admin/
│           ├── produits/route.ts               — POST/PATCH/DELETE produits (auth requise)
│           ├── categories/route.ts             — POST/PATCH/DELETE catégories (auth requise)
│           └── tables/route.ts                 — POST créer une table (auth requise)
├── components/
│   ├── Header.tsx                              — Nav publique (logo, liens Accueil/Menu/Contact)
│   └── Footer.tsx                              — Adresse, horaires courts, réseaux sociaux
├── lib/
│   ├── money.ts                                — formatPrix(centimes) → "5,90 €"
│   ├── cart.ts                                 — logique pure du panier (ajout/retrait/quantité/total)
│   ├── orderStatus.ts                          — transitions de statut + libellés affichés
│   ├── tableSlug.ts                            — slug de table + construction de l'URL de commande
│   ├── orderSession.ts                         — mémorise les IDs de commande du client (sessionStorage)
│   └── supabase/
│       ├── types.ts                            — types TypeScript du schéma DB
│       ├── browserClient.ts                    — client Supabase navigateur (clé anon)
│       ├── serverClient.ts                     — client Supabase server component (lit la session via cookies)
│       └── serviceClient.ts                    — client Supabase routes API (clé service role, jamais exposée au navigateur)
├── middleware.ts                               — protège /admin/* (sauf /admin/login) et /cuisine via la session Supabase
├── supabase/
│   ├── schema.sql                              — tables + policies RLS
│   └── seed.sql                                — données réelles du menu Cosy (catégories + produits)
├── vitest.config.ts
├── vitest.setup.ts
└── package.json / tsconfig.json / tailwind.config.ts / next.config.mjs
```

Each `lib/*.ts` file holds one pure, independently testable responsibility. Pages are server components that fetch data; interactive pieces (cart, real-time lists) are isolated into `*Client.tsx` client components so server components stay simple and testable-by-inspection.

---

## Task 1: Initialize the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.env.local.example`

- [ ] **Step 1: Scaffold the project**

Run from `/Users/papeabdoupaye/cosy-montbeliard/website`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-turbopack
```

When prompted, accept defaults. This creates `app/`, `tailwind.config.ts`, `tsconfig.json`, `package.json`, `.eslintrc.json`, `next.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`.

- [ ] **Step 2: Verify the dev server runs**

Run: `npm run dev` (in the background, or in a separate terminal), then `curl -sf http://localhost:3000 | head -c 200`
Expected: HTML output starting with `<!DOCTYPE html>`, no error. Stop the dev server afterwards.

- [ ] **Step 3: Create the env var template**

Create `.env.local.example`:

```bash
# Supabase — from your Supabase project's Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Public base URL used to build table QR-code links (no trailing slash)
# In local dev: http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Copy it to `.env.local` (gitignored) so local dev has the file present (values filled in during Task 4):

```bash
cp .env.local.example .env.local
```

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs app .eslintrc.json .gitignore .env.local.example
git commit -m "Initialize Next.js project with TypeScript and Tailwind"
```

---

## Task 2: Brand theme (Pop & Gourmand)

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Add brand color tokens to Tailwind config**

Edit `tailwind.config.ts` so the `theme.extend` block includes:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cosy: {
          pink: "#E9148C",
          "pink-dark": "#B80F6E",
          cream: "#FFF8F5",
          ink: "#1A1414",
        },
      },
      fontFamily: {
        display: ["Poppins", "Arial", "sans-serif"],
      },
      borderRadius: {
        pill: "999px",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Load the display font and set base body styles**

Edit `app/globals.css`, keep the existing `@tailwind` directives at the top, and append:

```css
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@600;800;900&display=swap");

body {
  @apply bg-cosy-cream text-cosy-ink font-sans;
}

h1, h2, h3, .font-display {
  @apply font-display;
}
```

- [ ] **Step 3: Verify Tailwind picks up the new tokens**

Temporarily add `<div className="bg-cosy-pink text-white p-4">test</div>` to `app/page.tsx`, run `npm run dev`, open `http://localhost:3000`, confirm the div renders with a solid hot-pink background. Remove the test div afterwards (Task 12 replaces `app/page.tsx` with the real Accueil content).

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "Add Cosy brand theme (Pop & Gourmand colors and display font)"
```

---

## Task 3: Testing infrastructure (Vitest)

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (add `test` script and dev dependencies)

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Create the setup file**

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add the test script**

Edit `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 5: Verify with a throwaway test**

Create `lib/__sanity.test.ts` temporarily:

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: `1 passed`. Delete `lib/__sanity.test.ts` afterwards.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "Set up Vitest testing infrastructure"
```

---

## Task 4: Supabase project + database schema

This task requires a Supabase account, which only the site owner can create (account creation is not something an agent should do on someone else's behalf). The steps below are manual instructions plus the SQL file to run.

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1 (manual, done by the user): Create the Supabase project**

1. Go to `https://supabase.com`, sign up or log in, click "New project".
2. Name it `cosy-montbeliard`, choose a region close to France (e.g. `eu-central-1`), set a database password (save it somewhere safe), create the project.
3. Once created, go to **Settings → API**. Copy the **Project URL**, the **anon public** key, and the **service_role** key.
4. Paste them into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

- [ ] **Step 2: Write the schema file**

Create `supabase/schema.sql`:

```sql
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
```

- [ ] **Step 3 (manual, done by the user): Run the schema**

In the Supabase dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql`, click "Run". Confirm the five tables appear under **Table Editor**.

- [ ] **Step 4 (manual, done by the user): Enable Realtime on the commandes tables**

In the Supabase dashboard, go to **Database → Replication**, and enable Realtime for `commandes` and `commande_lignes`.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add Supabase database schema with public-read RLS policies"
```

---

## Task 5: Supabase client modules

**Files:**
- Create: `lib/supabase/types.ts`
- Create: `lib/supabase/browserClient.ts`
- Create: `lib/supabase/serverClient.ts`
- Create: `lib/supabase/serviceClient.ts`

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Define the database types**

Create `lib/supabase/types.ts`:

```ts
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
```

- [ ] **Step 3: Browser client (anon key, used in client components)**

Create `lib/supabase/browserClient.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Server client (reads the auth session from cookies, used in server components/middleware)**

Create `lib/supabase/serverClient.ts`:

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}
```

- [ ] **Step 5: Service-role client (server-only, used exclusively inside `app/api/**/route.ts` files)**

Create `lib/supabase/serviceClient.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Never import this file from a client component: SUPABASE_SERVICE_ROLE_KEY
// must never reach the browser bundle.
export function createSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/supabase package.json package-lock.json
git commit -m "Add typed Supabase client modules (browser, server, service role)"
```

---

## Task 6: Seed data — real Cosy menu

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write the seed script with the real menu**

Create `supabase/seed.sql` (categories and products transcribed from the shop's existing ordering-app menu screenshots — 14 categories, ~90 products):

```sql
-- Categories, in display order
insert into categories (nom, emoji, ordre) values
  ('Formules', '✨', 1),
  ('Paninis', '🥖', 2),
  ('Wraps', '🌯', 3),
  ('Bagels', '🥯', 4),
  ('Toasty', '🥪', 5),
  ('Salades', '🥗', 6),
  ('Pâtes et Plats', '🍝', 7),
  ('Frites', '🍟', 8),
  ('Smoothies', '🥛', 9),
  ('Milkshakes & Frappés & Freakshakes', '🐄', 10),
  ('Gaufres & Crêpes', '🧇', 11),
  ('Pâtisseries & Spécialités Américaines', '🍩', 12),
  ('Boissons Soft & Chaudes', '🥤', 13),
  ('Glaces Artisanales', '🍦', 14);

with cat as (select id, nom from categories)
insert into produits (categorie_id, nom, description, prix_centimes, disponible, ordre)
select cat.id, v.nom, v.description, v.prix_centimes, v.disponible, v.ordre
from (values
  -- Formules (menus à emporter)
  ('Formules', 'Menu Pâtes Emporter', 'Pâtes, boisson et dessert', 1390, true, 1),
  ('Formules', 'Menu Salade Emporter', 'Salade, boisson et dessert', 1190, true, 2),
  ('Formules', 'Menu Panini & Wraps', 'Panini ou Wrap, boisson et dessert', 850, true, 3),
  ('Formules', 'Menu Bagel & Toasty', 'Bagel ou Toasty, boisson et dessert', 890, true, 4),
  -- Paninis
  ('Paninis', 'Panini Indien', 'Curry, mozzarella & émincés de poulet', 490, true, 1),
  ('Paninis', 'Panini Oriental', 'Sauce samouraï, mozzarella & poulet', 490, true, 2),
  ('Paninis', 'Panini 3 Fromages', 'Mozzarella, cheddar & chèvre', 490, true, 3),
  ('Paninis', 'Panini Saumon', 'Crème cheese, mozzarella, saumon fumé', 490, true, 4),
  -- Bagels
  ('Bagels', 'Bagel Poulet', 'Bagel recouvert de cheddar irlandais, crème, poulet', 590, true, 1),
  ('Bagels', 'Bagel Avocado (poulet guacamole)', 'Bagel recouvert de cheddar irlandais, crème, poulet, guacamole', 690, true, 2),
  ('Bagels', 'Bagel Saumon', 'Pain bagel recouvert de graines de sésame, saumon', 590, true, 3),
  ('Bagels', 'Bagel Green Smith (saumon guacamole)', 'Pain bagel recouvert de graines de sésame, saumon, guacamole', 690, true, 4),
  -- Toasty
  ('Toasty', 'Toasty Poulet Curry', 'Sauce curry, oignons frits, mozzarella & émincés de poulet', 590, true, 1),
  ('Toasty', 'Toasty Poulet Samouraï', 'Sauce samouraï, oignons frits, mozzarella & émincés de poulet', 590, true, 2),
  -- Salades (descriptions tronquées dans l'app source elle-même)
  ('Salades', 'Salade César', 'Salade verte, émincés de poulet, oignons frits...', 990, true, 1),
  ('Salades', 'Salade Océane', 'Salade verte, saumon fumé, tomates, croutons...', 990, true, 2),
  -- Pâtes et Plats
  ('Pâtes et Plats', 'Pâtes Penne', '', 990, true, 1),
  ('Pâtes et Plats', 'Pâtes Fusilli', '', 990, true, 2),
  ('Pâtes et Plats', 'Pâtes Conchiglie', '', 990, true, 3),
  -- Frites
  ('Frites', 'Frites', 'Frites 100g', 250, true, 1),
  -- Smoothies (35cl sauf mention contraire)
  ('Smoothies', 'Smoothie Fantasy 35cl', 'Fraise & banane, jus de pomme', 590, true, 1),
  ('Smoothies', 'Smoothie Sunset 35cl', 'Ananas, mangue & papaye, jus de pomme', 590, true, 2),
  ('Smoothies', 'Smoothie Heaven 35cl', 'Framboise, myrtille, mangue & pomme, jus de...', 590, true, 3),
  ('Smoothies', 'Smoothie Caraïbes 35cl', 'Ananas, fraise & coco, jus de pomme', 750, true, 4),
  ('Smoothies', 'Smooth Bubble', 'Smoothie parfum au choix et perle de tapioca', 690, true, 5),
  ('Smoothies', 'Smoothie Green Reviver 35cl', 'Mangue, banane, citronnelle, chou, jus de...', 590, true, 6),
  ('Smoothies', 'Smoothie Coconut 35cl', 'Ananas, lait de coco, jus de pomme', 590, true, 7),
  ('Smoothies', 'Smoothie Sweet Berry 35cl', 'Mûre, fraise, framboise', 590, true, 8),
  -- Milkshakes & Frappés & Freakshakes (typos "Milshake" du menu source normalisées en "Milkshake")
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Vanille', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 1),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Shtroumpf', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 2),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Fraise', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 3),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Passion', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 4),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Chocolat', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 5),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Caramel', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 6),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Café', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 7),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Licorne', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 8),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Citron', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 9),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Pistachio', 'À base de glace artisanale, lait, chantilly incluse', 650, true, 10),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Barbapapa', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 11),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Twister', 'Fraise, citron, citron vert, ananas', 550, true, 12),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Framboise', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 13),
  ('Milkshakes & Frappés & Freakshakes', 'Milkshake Chewing-gum', 'À base de glace artisanale, lait, chantilly incluse', 550, true, 14),
  ('Milkshakes & Frappés & Freakshakes', 'Bubble Shake', 'Milkshake parfum au choix et perle de tapioca', 650, true, 15),
  ('Milkshakes & Frappés & Freakshakes', 'Frappé Banane', 'À base de glace artisanale, lait, chantilly incluse', 590, true, 16),
  ('Milkshakes & Frappés & Freakshakes', 'Frappé Oréo', 'Glace vanille, oréo, lait, crème fouettée & topping...', 590, true, 17),
  ('Milkshakes & Frappés & Freakshakes', 'Frappé Bueno', 'Glace vanille, Kinder Bueno, lait, crème fouettée...', 590, true, 18),
  ('Milkshakes & Frappés & Freakshakes', 'Frappé M&M''s', 'Glace vanille, M&M''s, lait, crème fouettée & topping...', 590, true, 19),
  ('Milkshakes & Frappés & Freakshakes', 'Frappé Spéculoos', 'Glace vanille, Spéculoos, lait, crème fouettée & ...', 590, true, 20),
  ('Milkshakes & Frappés & Freakshakes', 'Freakshake Bueno', 'Glace vanille, Kinder Bueno, lait, crème fouettée & topping...', 790, true, 21),
  ('Milkshakes & Frappés & Freakshakes', 'Freakshake M&M''s', 'Glace vanille, M&M''s, lait, crème fouettée & topping...', 790, true, 22),
  ('Milkshakes & Frappés & Freakshakes', 'Freakshake Spéculoos', 'Glace vanille, Spéculoos, lait, crème fouettée & ...', 790, true, 23),
  ('Milkshakes & Frappés & Freakshakes', 'Freakshake Oréo', 'Glace vanille, oréo, lait, crème fouettée & topping...', 790, true, 24),
  -- Gaufres & Crêpes
  ('Gaufres & Crêpes', 'Gaufre Nature', '', 490, true, 1),
  ('Gaufres & Crêpes', 'Gaufre Nutella Banane', 'Gaufre de Liège Nutella + banane', 490, true, 2),
  ('Gaufres & Crêpes', 'Gaufre Crème Spéculoos', '', 550, true, 3),
  ('Gaufres & Crêpes', 'Gaufre Nutella Bueno', 'Gaufre de Liège Nutella Bueno', 490, true, 4),
  ('Gaufres & Crêpes', 'Gaufre Nutella', 'Gaufre de Liège Nutella', 550, true, 5),
  ('Gaufres & Crêpes', 'Gaufre Sucre', 'Gaufre de Liège Sucre', 350, true, 6),
  ('Gaufres & Crêpes', 'Gaufre Nutella Oréo', 'Gaufre de Liège Nutella Oréo', 490, true, 7),
  ('Gaufres & Crêpes', 'Gaufre Crème Bueno', 'Gaufre Crème Bueno', 390, true, 8),
  ('Gaufres & Crêpes', 'Gaufre Pistache', '', 450, true, 9),
  ('Gaufres & Crêpes', 'Crêpe Nature', '', 320, true, 10),
  ('Gaufres & Crêpes', 'Crêpe Crème Spéculoos', '', 450, true, 11),
  ('Gaufres & Crêpes', 'Crêpe Nutella Bueno', 'Nutella + Kinder Bueno', 490, true, 12),
  ('Gaufres & Crêpes', 'Crêpe Nutella Banane', 'Banane + Nutella', 490, true, 13),
  ('Gaufres & Crêpes', 'Crêpe Crème Bueno', '', 450, true, 14),
  -- Pâtisseries & Spécialités Américaines
  ('Pâtisseries & Spécialités Américaines', 'Muffin Pistache', '', 350, true, 1),
  ('Pâtisseries & Spécialités Américaines', 'Muffin Fruits Rouges', 'Fourré fruits rouges', 350, false, 2),
  ('Pâtisseries & Spécialités Américaines', 'Muffin Caramel', '', 350, true, 3),
  ('Pâtisseries & Spécialités Américaines', 'Muffin Chocolat', 'Fourré fondant chocolat', 350, true, 4),
  ('Pâtisseries & Spécialités Américaines', 'Muffin Nutella', 'Fourré Nutella', 450, true, 5),
  ('Pâtisseries & Spécialités Américaines', 'Muffin Myrtilles', 'Fourré myrtilles', 350, false, 6),
  ('Pâtisseries & Spécialités Américaines', 'Brownie', 'Brownie noix de pécan', 450, true, 7),
  ('Pâtisseries & Spécialités Américaines', 'Brookie', 'Mi cookie / mi brownie', 450, true, 8),
  ('Pâtisseries & Spécialités Américaines', 'Cookie Fourré', '', 290, true, 9),
  ('Pâtisseries & Spécialités Américaines', 'Cookie Cacao Fourré Dubaï Pistache', '', 290, true, 10),
  ('Pâtisseries & Spécialités Américaines', 'Cookie Cranberry Chocolat Blanc', '', 290, true, 11),
  ('Pâtisseries & Spécialités Américaines', 'Cookie Cacahuète Caramel', '', 290, false, 12),
  ('Pâtisseries & Spécialités Américaines', 'Donut Classic', 'Parfums divers', 220, true, 13),
  ('Pâtisseries & Spécialités Américaines', 'Donut Suprême', 'Parfums divers', 350, true, 14),
  ('Pâtisseries & Spécialités Américaines', 'Coulant Chocolat', '', 390, false, 15),
  ('Pâtisseries & Spécialités Américaines', 'Cheesecake Myrtilles', 'Cheesecake composé d''une couche de biscuits...', 390, true, 16),
  ('Pâtisseries & Spécialités Américaines', 'Red Velvet', 'Layer cake façon Red Velvet composé de...', 490, true, 17),
  ('Pâtisseries & Spécialités Américaines', 'Cheesecake Bueno', 'Cheesecake composé d''une couche de biscuits...', 490, true, 18),
  ('Pâtisseries & Spécialités Américaines', 'Cheesecake Spéculoos', 'Cheesecake composé d''une couche de biscuits...', 490, true, 19),
  ('Pâtisseries & Spécialités Américaines', 'Tarte à la Framboise', '', 290, false, 20),
  ('Pâtisseries & Spécialités Américaines', 'Tarte Citron Meringuée', '', 290, false, 21),
  ('Pâtisseries & Spécialités Américaines', 'Tiramisu', '', 390, false, 22),
  ('Pâtisseries & Spécialités Américaines', 'Tarte au Chocolat', '', 290, false, 23),
  ('Pâtisseries & Spécialités Américaines', 'Tarte aux Pommes', '', 290, true, 24),
  ('Pâtisseries & Spécialités Américaines', 'Tarte au Flan', '', 290, false, 25),
  ('Pâtisseries & Spécialités Américaines', 'Flan Cookie', '', 290, true, 26),
  -- Boissons Soft & Chaudes
  ('Boissons Soft & Chaudes', 'Lipton Pêche 33cl', '', 250, true, 1),
  ('Boissons Soft & Chaudes', 'Orangina 33cl', '', 250, true, 2),
  ('Boissons Soft & Chaudes', 'Oasis Tropical 33cl', '', 250, true, 3),
  ('Boissons Soft & Chaudes', 'Oasis Cassis / Framboise 33cl', '', 250, true, 4),
  ('Boissons Soft & Chaudes', 'Dada Cola 33cl', '', 250, true, 5),
  ('Boissons Soft & Chaudes', 'Dada Cola Zéro Sucre 33cl', '', 250, true, 6),
  ('Boissons Soft & Chaudes', 'Eau Plate Cristaline 50cl', '', 200, true, 7),
  ('Boissons Soft & Chaudes', 'Perrier 33cl', '', 250, true, 8),
  ('Boissons Soft & Chaudes', 'Red Bull', '', 300, true, 9),
  ('Boissons Soft & Chaudes', 'Expresso', '', 200, true, 10),
  ('Boissons Soft & Chaudes', 'Double Expresso', '', 350, true, 11),
  ('Boissons Soft & Chaudes', 'Expresso Crème', '', 220, true, 12),
  ('Boissons Soft & Chaudes', 'Café Latté', '', 350, true, 13),
  ('Boissons Soft & Chaudes', 'Cappuccino', '', 450, true, 14),
  ('Boissons Soft & Chaudes', 'Allongé', '', 250, true, 15),
  ('Boissons Soft & Chaudes', 'Chocolat Chaud', '', 450, true, 16)
) as v(cat_nom, nom, description, prix_centimes, disponible, ordre)
join cat on cat.nom = v.cat_nom;

-- A demo table for local testing
insert into tables (numero, slug) values (1, 'table-1');
```

**Notes for whoever runs this task:**
- `Wraps` and `Glaces Artisanales` are created as categories with **zero products** — the source screenshots ran out before their items rendered on screen. Add their real items via the admin panel (Task 24) once it exists, or extend this file if you get a fuller look at the source menu first.
- A few descriptions above end with "..." — that's not a transcription error, the source app's own menu already truncates those specific descriptions on screen. Update them with the full text once you have it (e.g. from the shop's supplier sheets), there's no rush since it doesn't block anything functionally.
- Several menu items had no visible description at all in the source screenshots (empty string here, e.g. "Pâtes Penne", most Gaufres/Crêpes, all Boissons) — left blank rather than invented.

- [ ] **Step 2 (manual, done by the user): Run the seed**

In the Supabase SQL Editor, paste and run `supabase/seed.sql` after `schema.sql`. Confirm rows appear in **Table Editor** under `categories` and `produits`.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "Add seed data for the real Cosy menu"
```

---

## Task 7: `lib/money.ts` — price formatting (TDD)

**Files:**
- Create: `lib/money.ts`
- Test: `lib/money.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatPrix } from "./money";

describe("formatPrix", () => {
  it("formats whole euros with two decimals", () => {
    expect(formatPrix(500)).toBe("5,00 €");
  });

  it("formats cents with a comma separator", () => {
    expect(formatPrix(590)).toBe("5,90 €");
  });

  it("formats amounts under one euro", () => {
    expect(formatPrix(220)).toBe("2,20 €");
  });

  it("formats zero", () => {
    expect(formatPrix(0)).toBe("0,00 €");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- money`
Expected: FAIL — `Cannot find module './money'`

- [ ] **Step 3: Implement**

Create `lib/money.ts`:

```ts
export function formatPrix(centimes: number): string {
  const euros = centimes / 100;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- money`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts lib/money.test.ts
git commit -m "Add formatPrix money formatting helper"
```

---

## Task 8: `lib/cart.ts` — cart logic (TDD)

**Files:**
- Create: `lib/cart.ts`
- Test: `lib/cart.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/cart.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addItem, removeItem, setQuantity, cartTotal, type CartItem } from "./cart";

const donut: CartItem = { produitId: "p1", nom: "Donut Classic", prixCentimes: 220, quantite: 1 };
const bagel: CartItem = { produitId: "p2", nom: "Bagel Poulet", prixCentimes: 590, quantite: 1 };

describe("addItem", () => {
  it("adds a new product to an empty cart", () => {
    expect(addItem([], donut)).toEqual([donut]);
  });

  it("increments quantity if the product is already in the cart", () => {
    const result = addItem([donut], donut);
    expect(result).toEqual([{ ...donut, quantite: 2 }]);
  });

  it("keeps other items untouched when adding a different product", () => {
    const result = addItem([donut], bagel);
    expect(result).toEqual([donut, bagel]);
  });
});

describe("removeItem", () => {
  it("removes the matching product entirely", () => {
    expect(removeItem([donut, bagel], "p1")).toEqual([bagel]);
  });

  it("is a no-op if the product isn't in the cart", () => {
    expect(removeItem([donut], "unknown")).toEqual([donut]);
  });
});

describe("setQuantity", () => {
  it("updates the quantity of a matching product", () => {
    expect(setQuantity([donut], "p1", 3)).toEqual([{ ...donut, quantite: 3 }]);
  });

  it("removes the item when quantity is set to 0", () => {
    expect(setQuantity([donut, bagel], "p1", 0)).toEqual([bagel]);
  });
});

describe("cartTotal", () => {
  it("sums price * quantity across items", () => {
    expect(cartTotal([donut, { ...bagel, quantite: 2 }])).toBe(220 + 590 * 2);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartTotal([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cart`
Expected: FAIL — `Cannot find module './cart'`

- [ ] **Step 3: Implement**

Create `lib/cart.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cart`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/cart.ts lib/cart.test.ts
git commit -m "Add pure cart logic (add/remove/quantity/total)"
```

---

## Task 9: `lib/orderStatus.ts` — status transitions (TDD)

**Files:**
- Create: `lib/orderStatus.ts`
- Test: `lib/orderStatus.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/orderStatus.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextStatus, statusLabel, type StatutCommande } from "./orderStatus";

describe("nextStatus", () => {
  it("moves from recue to en_preparation", () => {
    expect(nextStatus("recue")).toBe("en_preparation");
  });

  it("moves from en_preparation to prete", () => {
    expect(nextStatus("en_preparation")).toBe("prete");
  });

  it("returns null when already prete (no further transition)", () => {
    expect(nextStatus("prete")).toBeNull();
  });
});

describe("statusLabel", () => {
  it.each([
    ["recue", "Reçue"],
    ["en_preparation", "En préparation"],
    ["prete", "Prête"],
  ] as [StatutCommande, string][])("labels %s as %s", (statut, label) => {
    expect(statusLabel(statut)).toBe(label);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orderStatus`
Expected: FAIL — `Cannot find module './orderStatus'`

- [ ] **Step 3: Implement**

Create `lib/orderStatus.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orderStatus`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/orderStatus.ts lib/orderStatus.test.ts
git commit -m "Add order status transition and label helpers"
```

---

## Task 10: `lib/tableSlug.ts` — table slugs and QR URLs (TDD)

**Files:**
- Create: `lib/tableSlug.ts`
- Test: `lib/tableSlug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/tableSlug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugForTable, buildTableOrderUrl } from "./tableSlug";

describe("slugForTable", () => {
  it("builds a slug from a table number", () => {
    expect(slugForTable(7)).toBe("table-7");
  });

  it("pads nothing — numbers stay as-is", () => {
    expect(slugForTable(12)).toBe("table-12");
  });
});

describe("buildTableOrderUrl", () => {
  it("joins the base URL with the commander path and slug", () => {
    expect(buildTableOrderUrl("https://cosy-montbeliard.fr", "table-7")).toBe(
      "https://cosy-montbeliard.fr/commander/table-7"
    );
  });

  it("strips a trailing slash from the base URL", () => {
    expect(buildTableOrderUrl("https://cosy-montbeliard.fr/", "table-7")).toBe(
      "https://cosy-montbeliard.fr/commander/table-7"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tableSlug`
Expected: FAIL — `Cannot find module './tableSlug'`

- [ ] **Step 3: Implement**

Create `lib/tableSlug.ts`:

```ts
export function slugForTable(numero: number): string {
  return `table-${numero}`;
}

export function buildTableOrderUrl(baseUrl: string, slug: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/commander/${slug}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tableSlug`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/tableSlug.ts lib/tableSlug.test.ts
git commit -m "Add table slug and QR order URL helpers"
```

---

## Task 11: `lib/orderSession.ts` — remembering the customer's orders (TDD)

Customers aren't logged in, so we remember which orders belong to the current table visit in `sessionStorage`, keyed by table slug, so a page reload still shows "your orders" and their live status.

**Files:**
- Create: `lib/orderSession.ts`
- Test: `lib/orderSession.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/orderSession.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { saveOrderId, getOrderIds } from "./orderSession";

describe("orderSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns an empty array when nothing was saved", () => {
    expect(getOrderIds("table-1")).toEqual([]);
  });

  it("saves and retrieves an order id for a table", () => {
    saveOrderId("table-1", "order-a");
    expect(getOrderIds("table-1")).toEqual(["order-a"]);
  });

  it("accumulates multiple order ids for the same table", () => {
    saveOrderId("table-1", "order-a");
    saveOrderId("table-1", "order-b");
    expect(getOrderIds("table-1")).toEqual(["order-a", "order-b"]);
  });

  it("keeps different tables separate", () => {
    saveOrderId("table-1", "order-a");
    saveOrderId("table-2", "order-b");
    expect(getOrderIds("table-1")).toEqual(["order-a"]);
    expect(getOrderIds("table-2")).toEqual(["order-b"]);
  });

  it("does not duplicate an id saved twice", () => {
    saveOrderId("table-1", "order-a");
    saveOrderId("table-1", "order-a");
    expect(getOrderIds("table-1")).toEqual(["order-a"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orderSession`
Expected: FAIL — `Cannot find module './orderSession'`

- [ ] **Step 3: Implement**

Create `lib/orderSession.ts`:

```ts
function storageKey(tableSlug: string): string {
  return `cosy:commandes:${tableSlug}`;
}

export function getOrderIds(tableSlug: string): string[] {
  const raw = sessionStorage.getItem(storageKey(tableSlug));
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

export function saveOrderId(tableSlug: string, orderId: string): void {
  const existing = getOrderIds(tableSlug);
  if (existing.includes(orderId)) return;
  sessionStorage.setItem(storageKey(tableSlug), JSON.stringify([...existing, orderId]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orderSession`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/orderSession.ts lib/orderSession.test.ts
git commit -m "Add sessionStorage helpers to remember a table's orders"
```

---

## Task 12: Header, Footer, and root layout

**Files:**
- Create: `components/Header.tsx`
- Create: `components/Footer.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write the Header component**

Create `components/Header.tsx`:

```tsx
import Link from "next/link";

export function Header() {
  return (
    <header className="bg-cosy-pink text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-wide">
          Cosy <span className="font-normal">Café &amp; Cie</span>
        </Link>
        <nav className="flex gap-6 text-sm font-semibold uppercase tracking-wide">
          <Link href="/">Accueil</Link>
          <Link href="/menu">Menu</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Write the Footer component**

Create `components/Footer.tsx`:

```tsx
export function Footer() {
  return (
    <footer className="mt-16 border-t border-cosy-pink/20 bg-white py-8 text-sm text-cosy-ink/70">
      <div className="mx-auto max-w-5xl px-4">
        <p className="font-display font-bold text-cosy-ink">Cosy Café &amp; Cie</p>
        <p>4 Rue des Febvres, 25200 Montbéliard</p>
        <p className="mt-2">© {new Date().getFullYear()} Cosy Café &amp; Cie</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Wire them into the root layout**

Edit `app/layout.tsx` to replace its body content with:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Cosy Café & Cie — Montbéliard",
  description: "Café, pâtisseries, donuts, bagels et crêpes à Montbéliard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000`. Confirm the pink header with "Cosy Café & Cie" and nav links appears above the page content, and the footer with the address appears at the bottom.

- [ ] **Step 5: Commit**

```bash
git add components/Header.tsx components/Footer.tsx app/layout.tsx
git commit -m "Add Header, Footer, and wire them into the root layout"
```

---

## Task 13: Accueil (homepage)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the homepage content**

Replace `app/page.tsx` with:

```tsx
import Link from "next/link";

export default function AccueilPage() {
  return (
    <div>
      <section className="bg-cosy-pink px-4 py-20 text-center text-white">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
          Bienvenue chez Cosy
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg font-semibold">
          Des donuts qui donnent le sourire — café, pâtisseries maison, bagels, crêpes et
          milkshakes à Montbéliard.
        </p>
        <Link
          href="/menu"
          className="mt-8 inline-block rounded-pill bg-white px-8 py-3 font-display font-extrabold uppercase text-cosy-pink"
        >
          Voir le menu
        </Link>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-16 sm:grid-cols-4">
        {[
          { titre: "Café d'exception", desc: "Torréfaction sélectionnée" },
          { titre: "Pâtisseries maison", desc: "Faites sur place chaque jour" },
          { titre: "Snacking gourmand", desc: "Bagels, toasts, salades" },
          { titre: "Un lieu convivial", desc: "Sur place ou à emporter" },
        ].map((item) => (
          <div key={item.titre} className="text-center">
            <p className="font-display font-extrabold uppercase text-cosy-pink">{item.titre}</p>
            <p className="mt-1 text-sm text-cosy-ink/70">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000`. Confirm the pink hero renders with the heading, subtext, and "Voir le menu" button linking to `/menu` (the link will 404 until Task 14 — that's expected at this point).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "Add Accueil homepage"
```

---

## Task 14: Menu page (public, read-only)

**Files:**
- Create: `app/menu/page.tsx`

- [ ] **Step 1: Write the server component**

Create `app/menu/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { formatPrix } from "@/lib/money";

export default async function MenuPage() {
  const supabase = createSupabaseServerClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("ordre", { ascending: true });

  const { data: produits } = await supabase
    .from("produits")
    .select("*")
    .order("ordre", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-black uppercase text-cosy-pink">Notre menu</h1>

      {(categories ?? []).map((categorie) => {
        const produitsCategorie = (produits ?? []).filter((p) => p.categorie_id === categorie.id);
        if (produitsCategorie.length === 0) return null;

        return (
          <section key={categorie.id} className="mt-10">
            <h2 className="font-display text-xl font-extrabold">
              {categorie.emoji} {categorie.nom}
            </h2>
            <ul className="mt-4 divide-y divide-cosy-pink/10">
              {produitsCategorie.map((produit) => (
                <li key={produit.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold">
                      {produit.nom}
                      {!produit.disponible && (
                        <span className="ml-2 text-xs font-normal uppercase text-cosy-ink/40">
                          Indisponible
                        </span>
                      )}
                    </p>
                    {produit.description && (
                      <p className="text-sm text-cosy-ink/60">{produit.description}</p>
                    )}
                  </div>
                  <p className="whitespace-nowrap font-display font-bold text-cosy-pink">
                    {formatPrix(produit.prix_centimes)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

With `.env.local` filled in (Task 4) and the seed data run (Task 6), run `npm run dev`, open `http://localhost:3000/menu`. Confirm categories and products appear with correct prices, and the "Muffin Myrtilles" item shows the "Indisponible" tag.

- [ ] **Step 3: Commit**

```bash
git add app/menu/page.tsx
git commit -m "Add public read-only Menu page"
```

---

## Task 15: Contact & horaires page

**Files:**
- Create: `app/contact/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/contact/page.tsx`:

```tsx
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-black uppercase text-cosy-pink">
        Contact &amp; horaires
      </h1>

      <div className="mt-8 space-y-6">
        <div>
          <h2 className="font-display font-extrabold">Adresse</h2>
          <p>4 Rue des Febvres, 25200 Montbéliard</p>
        </div>

        <div>
          <h2 className="font-display font-extrabold">Horaires</h2>
          <ul className="mt-1 space-y-1 text-cosy-ink/80">
            <li>Lundi – Vendredi : 8h00 – 19h00</li>
            <li>Samedi : 9h00 – 19h00</li>
            <li>Dimanche : 9h00 – 13h00</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display font-extrabold">Nous contacter</h2>
          <p>
            <a href="tel:+33300000000" className="text-cosy-pink underline">
              03 00 00 00 00
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fill in real details**

Replace the placeholder phone number and confirm/adjust the opening hours with the owner's actual values before shipping — the address is already correct (from the business registry lookup), but hours and phone need to come from the owner directly.

- [ ] **Step 3: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000/contact`. Confirm address, hours, and phone render.

- [ ] **Step 4: Commit**

```bash
git add app/contact/page.tsx
git commit -m "Add Contact and horaires page"
```

---

## Task 16: API route — create a commande (public)

**Files:**
- Create: `app/api/commandes/route.ts`
- Test: `app/api/commandes/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/commandes/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertCommande = vi.fn();
const insertLignes = vi.fn();

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === "commandes") {
        return {
          insert: insertCommande,
        };
      }
      if (table === "commande_lignes") {
        return {
          insert: insertLignes,
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  insertCommande.mockReset();
  insertLignes.mockReset();
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/commandes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/commandes", () => {
  it("returns 400 when tableId is missing", async () => {
    const res = await POST(jsonRequest({ lignes: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lignes is empty", async () => {
    const res = await POST(jsonRequest({ tableId: "t1", lignes: [] }));
    expect(res.status).toBe(400);
  });

  it("creates the commande then its lignes, and returns the new id", async () => {
    insertCommande.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: { id: "cmd-1" }, error: null }),
      }),
    });
    insertLignes.mockReturnValue(Promise.resolve({ error: null }));

    const res = await POST(
      jsonRequest({
        tableId: "t1",
        lignes: [{ produitId: "p1", nom: "Donut Classic", prixCentimes: 220, quantite: 2 }],
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: "cmd-1" });
    expect(insertCommande).toHaveBeenCalledWith({ table_id: "t1", statut: "recue" });
    expect(insertLignes).toHaveBeenCalledWith([
      {
        commande_id: "cmd-1",
        produit_id: "p1",
        nom_produit: "Donut Classic",
        prix_unitaire_centimes: 220,
        quantite: 2,
      },
    ]);
  });

  it("returns 500 when the commande insert fails", async () => {
    insertCommande.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: { message: "db error" } }),
      }),
    });

    const res = await POST(
      jsonRequest({
        tableId: "t1",
        lignes: [{ produitId: "p1", nom: "Donut Classic", prixCentimes: 220, quantite: 1 }],
      })
    );

    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/commandes/route`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement**

Create `app/api/commandes/route.ts`:

```ts
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";

interface LigneEntree {
  produitId: string;
  nom: string;
  prixCentimes: number;
  quantite: number;
}

interface CreerCommandeEntree {
  tableId?: string;
  lignes?: LigneEntree[];
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreerCommandeEntree;

  if (!body.tableId) {
    return Response.json({ error: "tableId requis" }, { status: 400 });
  }
  if (!body.lignes || body.lignes.length === 0) {
    return Response.json({ error: "au moins une ligne requise" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: commande, error: commandeError } = await supabase
    .from("commandes")
    .insert({ table_id: body.tableId, statut: "recue" })
    .select()
    .single();

  if (commandeError || !commande) {
    return Response.json({ error: "impossible de créer la commande" }, { status: 500 });
  }

  const { error: lignesError } = await supabase.from("commande_lignes").insert(
    body.lignes.map((ligne) => ({
      commande_id: commande.id,
      produit_id: ligne.produitId,
      nom_produit: ligne.nom,
      prix_unitaire_centimes: ligne.prixCentimes,
      quantite: ligne.quantite,
    }))
  );

  if (lignesError) {
    return Response.json({ error: "impossible d'enregistrer les articles" }, { status: 500 });
  }

  return Response.json({ id: commande.id }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/commandes/route`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/commandes/route.ts app/api/commandes/route.test.ts
git commit -m "Add POST /api/commandes to create table orders"
```

---

## Task 17: API route — update commande status (auth required)

**Files:**
- Create: `app/api/commandes/[id]/statut/route.ts`
- Test: `app/api/commandes/[id]/statut/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/commandes/[id]/statut/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const update = vi.fn();
const eq = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser },
  }),
}));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq };
      },
    }),
  }),
}));

import { PATCH } from "./route";

beforeEach(() => {
  getUser.mockReset();
  update.mockReset();
  eq.mockReset();
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/commandes/cmd-1/statut", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/commandes/[id]/statut", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await PATCH(jsonRequest({ statut: "en_preparation" }), {
      params: { id: "cmd-1" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid status value", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });

    const res = await PATCH(jsonRequest({ statut: "pas_un_statut" }), {
      params: { id: "cmd-1" },
    });

    expect(res.status).toBe(400);
  });

  it("updates the status when authenticated with a valid status", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });
    eq.mockResolvedValue({ error: null });

    const res = await PATCH(jsonRequest({ statut: "en_preparation" }), {
      params: { id: "cmd-1" },
    });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ statut: "en_preparation" });
    expect(eq).toHaveBeenCalledWith("id", "cmd-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- statut/route`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement**

Create `app/api/commandes/[id]/statut/route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";

const STATUTS_VALIDES = ["recue", "en_preparation", "prete"] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabaseAuth = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return Response.json({ error: "authentification requise" }, { status: 401 });
  }

  const body = (await request.json()) as { statut?: string };

  if (!body.statut || !STATUTS_VALIDES.includes(body.statut as (typeof STATUTS_VALIDES)[number])) {
    return Response.json({ error: "statut invalide" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("commandes")
    .update({ statut: body.statut })
    .eq("id", params.id);

  if (error) {
    return Response.json({ error: "impossible de mettre à jour le statut" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- statut/route`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add "app/api/commandes/[id]/statut/route.ts" "app/api/commandes/[id]/statut/route.test.ts"
git commit -m "Add PATCH endpoint to update order status (auth required)"
```

---

## Task 18: Table ordering page — resolve the table

**Files:**
- Create: `app/commander/[slug]/page.tsx`

- [ ] **Step 1: Write the server component**

Create `app/commander/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { CommandeClient } from "./CommandeClient";

export default async function CommanderPage({ params }: { params: { slug: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: table } = await supabase
    .from("tables")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!table) {
    notFound();
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("ordre", { ascending: true });

  const { data: produits } = await supabase
    .from("produits")
    .select("*")
    .eq("disponible", true)
    .order("ordre", { ascending: true });

  return (
    <CommandeClient
      table={table}
      categories={categories ?? []}
      produits={produits ?? []}
    />
  );
}
```

- [ ] **Step 2: Verify the 404 case**

This can only be fully verified once Task 19 exists (the client component doesn't exist yet), but confirm the file compiles once Task 19 lands. Skip standalone verification here.

- [ ] **Step 3: Commit**

Hold this commit — commit together with Task 19 since `CommandeClient` doesn't exist yet and the project wouldn't build in between. Proceed directly to Task 19.

---

## Task 19: Table ordering page — cart UI and order submission

**Files:**
- Create: `app/commander/[slug]/CommandeClient.tsx`

- [ ] **Step 1: Write the client component**

Create `app/commander/[slug]/CommandeClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import { addItem, cartTotal, setQuantity, type CartItem } from "@/lib/cart";
import { formatPrix } from "@/lib/money";
import { saveOrderId } from "@/lib/orderSession";
import type { Categorie, Produit, TableRestaurant } from "@/lib/supabase/types";
import { OrdersStatus } from "./OrdersStatus";

interface Props {
  table: TableRestaurant;
  categories: Categorie[];
  produits: Produit[];
}

export function CommandeClient({ table, categories, produits }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [derniereCommandeId, setDerniereCommandeId] = useState<string | null>(null);

  function handleAjouter(produit: Produit) {
    setCart((current) =>
      addItem(current, {
        produitId: produit.id,
        nom: produit.nom,
        prixCentimes: produit.prix_centimes,
        quantite: 1,
      })
    );
  }

  async function handleValider() {
    if (cart.length === 0) return;
    setEnvoiEnCours(true);
    setErreur(null);

    try {
      const res = await fetch("/api/commandes", {
        method: "POST",
        body: JSON.stringify({
          tableId: table.id,
          lignes: cart.map((item) => ({
            produitId: item.produitId,
            nom: item.nom,
            prixCentimes: item.prixCentimes,
            quantite: item.quantite,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error("La commande n'a pas pu être envoyée");
      }

      const { id } = (await res.json()) as { id: string };
      saveOrderId(table.slug, id);
      setDerniereCommandeId(id);
      setCart([]);
    } catch {
      setErreur("Impossible d'envoyer la commande. Vérifiez votre connexion et réessayez.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">
        Table {table.numero} — Commander
      </h1>

      <OrdersStatus tableSlug={table.slug} justPlacedOrderId={derniereCommandeId} />

      {categories.map((categorie) => {
        const produitsCategorie = produits.filter((p) => p.categorie_id === categorie.id);
        if (produitsCategorie.length === 0) return null;

        return (
          <section key={categorie.id} className="mt-8">
            <h2 className="font-display font-extrabold">
              {categorie.emoji} {categorie.nom}
            </h2>
            <ul className="mt-2 divide-y divide-cosy-pink/10">
              {produitsCategorie.map((produit) => (
                <li key={produit.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold">{produit.nom}</p>
                    <p className="text-sm text-cosy-ink/60">{formatPrix(produit.prix_centimes)}</p>
                  </div>
                  <button
                    onClick={() => handleAjouter(produit)}
                    className="rounded-pill bg-cosy-pink px-4 py-2 text-sm font-bold text-white"
                  >
                    Ajouter
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-cosy-pink/20 bg-white p-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <ul className="text-sm">
              {cart.map((item) => (
                <li key={item.produitId} className="flex items-center gap-2">
                  <span>
                    {item.quantite} × {item.nom}
                  </span>
                  <button
                    onClick={() => setCart((c) => setQuantity(c, item.produitId, item.quantite - 1))}
                    aria-label={`Retirer un ${item.nom}`}
                    className="text-cosy-pink"
                  >
                    −
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={handleValider}
              disabled={envoiEnCours}
              className="rounded-pill bg-cosy-pink px-6 py-3 font-display font-extrabold text-white disabled:opacity-50"
            >
              {envoiEnCours ? "Envoi..." : `Commander · ${formatPrix(cartTotal(cart))}`}
            </button>
          </div>
          {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000/commander/table-1` (the seed data from Task 6 creates `table-1`). Add a couple of products, confirm the sticky cart bar appears at the bottom with the running total, click "Commander", confirm it clears the cart (the `OrdersStatus` component built in Task 20 will show the live status — until then, expect a build error referencing the missing `./OrdersStatus` module; that's resolved by the next task).

- [ ] **Step 3: Commit**

Hold this commit too — commit together with Task 20, since `OrdersStatus` doesn't exist yet.

---

## Task 20: Real-time order status for the customer

**Files:**
- Create: `app/commander/[slug]/OrdersStatus.tsx`

- [ ] **Step 1: Write the component**

Create `app/commander/[slug]/OrdersStatus.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";
import { getOrderIds, saveOrderId } from "@/lib/orderSession";
import { statusLabel, type StatutCommande } from "@/lib/orderStatus";

interface Props {
  tableSlug: string;
  justPlacedOrderId: string | null;
}

interface CommandeSuivie {
  id: string;
  statut: StatutCommande;
}

export function OrdersStatus({ tableSlug, justPlacedOrderId }: Props) {
  const [commandes, setCommandes] = useState<CommandeSuivie[]>([]);

  useEffect(() => {
    if (justPlacedOrderId) {
      saveOrderId(tableSlug, justPlacedOrderId);
    }
  }, [justPlacedOrderId, tableSlug]);

  useEffect(() => {
    const orderIds = getOrderIds(tableSlug);
    if (orderIds.length === 0) return;

    const supabase = createSupabaseBrowserClient();

    supabase
      .from("commandes")
      .select("id, statut")
      .in("id", orderIds)
      .then(({ data }) => {
        if (data) setCommandes(data as CommandeSuivie[]);
      });

    const channel = supabase
      .channel(`commandes-${tableSlug}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          const updated = payload.new as CommandeSuivie;
          setCommandes((current) =>
            current.map((c) => (c.id === updated.id ? { ...c, statut: updated.statut } : c))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableSlug, justPlacedOrderId]);

  if (commandes.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-cosy-pink/20 bg-white p-4">
      <p className="font-display font-extrabold">Vos commandes</p>
      <ul className="mt-2 space-y-1 text-sm">
        {commandes.map((commande) => (
          <li key={commande.id} className="flex items-center justify-between">
            <span>Commande #{commande.id.slice(0, 8)}</span>
            <span className="font-semibold text-cosy-pink">{statusLabel(commande.statut)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000/commander/table-1`, place an order. Confirm the "Vos commandes" box appears showing "Reçue". Open the Supabase Table Editor in another tab, manually change that commande's `statut` to `en_preparation`, and confirm the label on the page updates to "En préparation" within a couple seconds without reloading.

- [ ] **Step 3: Commit (covers Tasks 18–20 together)**

```bash
git add "app/commander/[slug]/page.tsx" "app/commander/[slug]/CommandeClient.tsx" "app/commander/[slug]/OrdersStatus.tsx"
git commit -m "Add table ordering page: cart, submission, and live order status"
```

---

## Task 21: Staff login and route protection

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `middleware.ts`

- [ ] **Step 1 (manual, done by the user): Create the staff/admin account**

In the Supabase dashboard, go to **Authentication → Users → Add user**, create one account with an email and password for the shop (this single account is shared by whoever works the kitchen screen and whoever manages the menu — the spec doesn't require per-employee accounts).

- [ ] **Step 2: Write the login page**

Create `app/admin/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });

    if (error) {
      setErreur("Identifiants incorrects.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Connexion</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-cosy-ink/20 px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className="w-full rounded border border-cosy-ink/20 px-3 py-2"
          required
        />
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <button
          type="submit"
          className="w-full rounded-pill bg-cosy-pink py-3 font-display font-extrabold text-white"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Write the middleware**

Create `middleware.ts` at the project root:

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const isProtected =
    (request.nextUrl.pathname.startsWith("/admin") &&
      request.nextUrl.pathname !== "/admin/login") ||
    request.nextUrl.pathname.startsWith("/cuisine");

  if (!isProtected) return NextResponse.next();

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/cuisine/:path*"],
};
```

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000/admin` while logged out — confirm it redirects to `/admin/login`. Log in with the account created in Step 1, confirm it redirects to `/admin` (this page doesn't exist yet until Task 23 — a 404 there is expected and fine; what matters is the auth redirect behavior).

- [ ] **Step 5: Commit**

```bash
git add app/admin/login/page.tsx middleware.ts
git commit -m "Add staff login and route protection for /admin and /cuisine"
```

---

## Task 22: Kitchen screen

**Files:**
- Create: `app/cuisine/page.tsx`
- Create: `app/cuisine/CuisineClient.tsx`

- [ ] **Step 1: Write the server component**

Create `app/cuisine/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { CuisineClient } from "./CuisineClient";

export default async function CuisinePage() {
  const supabase = createSupabaseServerClient();

  const { data: commandes } = await supabase
    .from("commandes")
    .select("*")
    .neq("statut", "prete")
    .order("created_at", { ascending: true });

  const { data: lignes } = await supabase.from("commande_lignes").select("*");
  const { data: tables } = await supabase.from("tables").select("*");

  return (
    <CuisineClient
      commandesInitiales={commandes ?? []}
      lignes={lignes ?? []}
      tables={tables ?? []}
    />
  );
}
```

- [ ] **Step 2: Write the client component**

Create `app/cuisine/CuisineClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";
import { nextStatus, statusLabel } from "@/lib/orderStatus";
import type { Commande, CommandeLigne, TableRestaurant } from "@/lib/supabase/types";

interface Props {
  commandesInitiales: Commande[];
  lignes: CommandeLigne[];
  tables: TableRestaurant[];
}

export function CuisineClient({ commandesInitiales, lignes, tables }: Props) {
  const [commandes, setCommandes] = useState(commandesInitiales);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel("cuisine-commandes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commandes" },
        (payload) => {
          setCommandes((current) => [...current, payload.new as Commande]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          const updated = payload.new as Commande;
          setCommandes((current) =>
            updated.statut === "prete"
              ? current.filter((c) => c.id !== updated.id)
              : current.map((c) => (c.id === updated.id ? updated : c))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleAvancer(commande: Commande) {
    const next = nextStatus(commande.statut);
    if (!next) return;

    await fetch(`/api/commandes/${commande.id}/statut`, {
      method: "PATCH",
      body: JSON.stringify({ statut: next }),
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Cuisine</h1>

      <div className="mt-6 space-y-4">
        {commandes.map((commande) => {
          const table = tables.find((t) => t.id === commande.table_id);
          const lignesCommande = lignes.filter((l) => l.commande_id === commande.id);

          return (
            <div key={commande.id} className="rounded-lg border border-cosy-pink/20 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-display font-extrabold">
                  Table {table?.numero ?? "?"} — {statusLabel(commande.statut)}
                </p>
                <button
                  onClick={() => handleAvancer(commande)}
                  className="rounded-pill bg-cosy-pink px-4 py-2 text-sm font-bold text-white"
                >
                  {commande.statut === "recue" ? "Démarrer" : "Marquer prête"}
                </button>
              </div>
              <ul className="mt-2 text-sm text-cosy-ink/70">
                {lignesCommande.map((ligne) => (
                  <li key={ligne.id}>
                    {ligne.quantite} × {ligne.nom_produit}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {commandes.length === 0 && <p className="text-cosy-ink/50">Aucune commande en cours.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Log in at `/admin/login`, open `http://localhost:3000/cuisine`. In another (unauthenticated) tab, place an order from `/commander/table-1`. Confirm it appears on the kitchen screen within a couple seconds without reloading. Click "Démarrer", confirm the label changes to "En préparation". Click "Marquer prête", confirm the card disappears from the kitchen screen and (from Task 20) the customer's status page shows "Prête".

- [ ] **Step 4: Commit**

```bash
git add app/cuisine/page.tsx app/cuisine/CuisineClient.tsx
git commit -m "Add real-time kitchen screen"
```

---

## Task 23: Admin — API routes for produits, categories, tables

**Files:**
- Create: `app/api/admin/produits/route.ts`
- Create: `app/api/admin/categories/route.ts`
- Create: `app/api/admin/tables/route.ts`
- Test: `app/api/admin/produits/route.test.ts`

- [ ] **Step 1: Write the failing test for the produits route (the pattern is then repeated by hand for categories/tables)**

Create `app/api/admin/produits/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const eqUpdate = vi.fn();
const del = vi.fn();
const eqDelete = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({
      insert,
      update: (values: unknown) => {
        update(values);
        return { eq: eqUpdate };
      },
      delete: () => {
        del();
        return { eq: eqDelete };
      },
    }),
  }),
}));

import { POST, PATCH, DELETE } from "./route";

beforeEach(() => {
  getUser.mockReset();
  insert.mockReset();
  update.mockReset();
  eqUpdate.mockReset();
  del.mockReset();
  eqDelete.mockReset();
});

function req(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/produits", { method, body: JSON.stringify(body) });
}

describe("/api/admin/produits", () => {
  it("POST returns 401 when not authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req("POST", { nom: "Donut" }));
    expect(res.status).toBe(401);
  });

  it("POST inserts the product when authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });
    insert.mockResolvedValue({ error: null });

    const res = await POST(
      req("POST", {
        categorieId: "cat-1",
        nom: "Donut Classic",
        description: "Parfums divers",
        prixCentimes: 220,
      })
    );

    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      categorie_id: "cat-1",
      nom: "Donut Classic",
      description: "Parfums divers",
      prix_centimes: 220,
      disponible: true,
    });
  });

  it("PATCH updates fields for a given product id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });
    eqUpdate.mockResolvedValue({ error: null });

    const res = await PATCH(req("PATCH", { id: "p1", disponible: false }));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ disponible: false });
    expect(eqUpdate).toHaveBeenCalledWith("id", "p1");
  });

  it("DELETE removes a product by id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });
    eqDelete.mockResolvedValue({ error: null });

    const res = await DELETE(req("DELETE", { id: "p1" }));

    expect(res.status).toBe(200);
    expect(eqDelete).toHaveBeenCalledWith("id", "p1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- admin/produits/route`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement the produits route**

Create `app/api/admin/produits/route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";

async function requireAuth() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as {
    categorieId: string;
    nom: string;
    description: string;
    prixCentimes: number;
  };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("produits").insert({
    categorie_id: body.categorieId,
    nom: body.nom,
    description: body.description,
    prix_centimes: body.prixCentimes,
    disponible: true,
  });

  if (error) return Response.json({ error: "création impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { id: string } & Record<string, unknown>;
  const { id, ...champs } = body;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("produits").update(champs).eq("id", id);

  if (error) return Response.json({ error: "mise à jour impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { id: string };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("produits").delete().eq("id", body.id);

  if (error) return Response.json({ error: "suppression impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- admin/produits/route`
Expected: `4 passed`

- [ ] **Step 5: Implement the categories route (same pattern, no dedicated test file — covered by the produits route test above validating the shared auth/CRUD pattern; add one smoke test to keep coverage minimal but present)**

Create `app/api/admin/categories/route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";

async function requireAuth() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { nom: string; emoji?: string; ordre: number };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("categories").insert({
    nom: body.nom,
    emoji: body.emoji ?? null,
    ordre: body.ordre,
  });

  if (error) return Response.json({ error: "création impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { id: string };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("categories").delete().eq("id", body.id);

  if (error) return Response.json({ error: "suppression impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 6: Write a smoke test for the categories route**

Create `app/api/admin/categories/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({ from: () => ({ insert }) }),
}));

import { POST } from "./route";

beforeEach(() => {
  getUser.mockReset();
  insert.mockReset();
});

describe("POST /api/admin/categories", () => {
  it("returns 401 when not authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ nom: "Bagels", ordre: 1 }) })
    );
    expect(res.status).toBe(401);
  });

  it("inserts the category when authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });
    insert.mockResolvedValue({ error: null });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ nom: "Bagels", emoji: "🥯", ordre: 1 }),
      })
    );

    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ nom: "Bagels", emoji: "🥯", ordre: 1 });
  });
});
```

Run: `npm test -- admin/categories/route`
Expected: `2 passed`

- [ ] **Step 7: Implement the tables route**

Create `app/api/admin/tables/route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { slugForTable } from "@/lib/tableSlug";

async function requireAuth() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { numero: number };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("tables").insert({
    numero: body.numero,
    slug: slugForTable(body.numero),
  });

  if (error) return Response.json({ error: "création impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 8: Write a smoke test for the tables route**

Create `app/api/admin/tables/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  createSupabaseServerClient: () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/supabase/serviceClient", () => ({
  createSupabaseServiceClient: () => ({ from: () => ({ insert }) }),
}));

import { POST } from "./route";

beforeEach(() => {
  getUser.mockReset();
  insert.mockReset();
});

describe("POST /api/admin/tables", () => {
  it("builds the slug from the table number", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });
    insert.mockResolvedValue({ error: null });

    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ numero: 7 }) })
    );

    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ numero: 7, slug: "table-7" });
  });
});
```

Run: `npm test -- admin/tables/route`
Expected: `1 passed`

- [ ] **Step 9: Commit**

```bash
git add app/api/admin
git commit -m "Add authenticated admin API routes for produits, categories, tables"
```

---

## Task 24: Admin — produits/catégories management UI

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/produits/page.tsx`
- Create: `app/admin/produits/ProduitsClient.tsx`

- [ ] **Step 1: Write the admin dashboard**

Create `app/admin/page.tsx`:

```tsx
import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Admin</h1>
      <ul className="mt-6 space-y-3">
        <li>
          <Link href="/admin/produits" className="font-semibold text-cosy-pink underline">
            Gérer le menu (produits &amp; catégories)
          </Link>
        </li>
        <li>
          <Link href="/admin/tables" className="font-semibold text-cosy-pink underline">
            Gérer les tables &amp; QR codes
          </Link>
        </li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Write the produits server component**

Create `app/admin/produits/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { ProduitsClient } from "./ProduitsClient";

export default async function AdminProduitsPage() {
  const supabase = createSupabaseServerClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("ordre", { ascending: true });

  const { data: produits } = await supabase
    .from("produits")
    .select("*")
    .order("ordre", { ascending: true });

  return <ProduitsClient categoriesInitiales={categories ?? []} produitsInitiaux={produits ?? []} />;
}
```

- [ ] **Step 3: Write the client component**

Create `app/admin/produits/ProduitsClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import { formatPrix } from "@/lib/money";
import type { Categorie, Produit } from "@/lib/supabase/types";

interface Props {
  categoriesInitiales: Categorie[];
  produitsInitiaux: Produit[];
}

export function ProduitsClient({ categoriesInitiales, produitsInitiaux }: Props) {
  const [categories] = useState(categoriesInitiales);
  const [produits, setProduits] = useState(produitsInitiaux);

  async function toggleDisponible(produit: Produit) {
    const disponible = !produit.disponible;
    setProduits((current) =>
      current.map((p) => (p.id === produit.id ? { ...p, disponible } : p))
    );

    await fetch("/api/admin/produits", {
      method: "PATCH",
      body: JSON.stringify({ id: produit.id, disponible }),
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Menu</h1>

      {categories.map((categorie) => (
        <section key={categorie.id} className="mt-8">
          <h2 className="font-display font-extrabold">
            {categorie.emoji} {categorie.nom}
          </h2>
          <ul className="mt-2 divide-y divide-cosy-pink/10">
            {produits
              .filter((p) => p.categorie_id === categorie.id)
              .map((produit) => (
                <li key={produit.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold">{produit.nom}</p>
                    <p className="text-sm text-cosy-ink/60">{formatPrix(produit.prix_centimes)}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={produit.disponible}
                      onChange={() => toggleDisponible(produit)}
                    />
                    Disponible
                  </label>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <p className="mt-8 text-sm text-cosy-ink/50">
        Ajout de nouveaux produits/catégories : à faire évoluer ici au besoin (ce premier admin
        couvre la disponibilité en un clic, le geste le plus fréquent au quotidien).
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Log in, open `http://localhost:3000/admin/produits`. Confirm categories/products list with checkboxes, and unchecking "Muffin Nutella" makes it disappear from `/menu` and from `/commander/table-1` within a page reload.

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx app/admin/produits
git commit -m "Add admin dashboard and product availability management UI"
```

---

## Task 25: Admin — tables and QR code generation

**Files:**
- Create: `app/admin/tables/page.tsx`
- Create: `app/admin/tables/TablesClient.tsx`
- Create: `lib/qrcode.ts`
- Test: `lib/qrcode.test.ts`

- [ ] **Step 1: Install the QR code library**

```bash
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Write the failing test for the QR helper**

Create `lib/qrcode.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateQrCodeDataUrl } from "./qrcode";

describe("generateQrCodeDataUrl", () => {
  it("returns a PNG data URL", async () => {
    const dataUrl = await generateQrCodeDataUrl("https://cosy-montbeliard.fr/commander/table-7");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- qrcode`
Expected: FAIL — `Cannot find module './qrcode'`

- [ ] **Step 4: Implement**

Create `lib/qrcode.ts`:

```ts
import QRCode from "qrcode";

export async function generateQrCodeDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 320 });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- qrcode`
Expected: `1 passed`

- [ ] **Step 6: Write the tables server component**

Create `app/admin/tables/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { buildTableOrderUrl } from "@/lib/tableSlug";
import { generateQrCodeDataUrl } from "@/lib/qrcode";
import { TablesClient } from "./TablesClient";

export default async function AdminTablesPage() {
  const supabase = createSupabaseServerClient();
  const { data: tables } = await supabase.from("tables").select("*").order("numero");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const tablesAvecQr = await Promise.all(
    (tables ?? []).map(async (table) => ({
      table,
      qrDataUrl: await generateQrCodeDataUrl(buildTableOrderUrl(siteUrl, table.slug)),
    }))
  );

  return <TablesClient tablesAvecQr={tablesAvecQr} />;
}
```

- [ ] **Step 7: Write the client component**

Create `app/admin/tables/TablesClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { TableRestaurant } from "@/lib/supabase/types";

interface Props {
  tablesAvecQr: { table: TableRestaurant; qrDataUrl: string }[];
}

export function TablesClient({ tablesAvecQr: initial }: Props) {
  const [tablesAvecQr, setTablesAvecQr] = useState(initial);
  const [numero, setNumero] = useState("");

  async function handleCreer(e: React.FormEvent) {
    e.preventDefault();
    const numeroInt = parseInt(numero, 10);
    if (!numeroInt) return;

    await fetch("/api/admin/tables", {
      method: "POST",
      body: JSON.stringify({ numero: numeroInt }),
    });

    setNumero("");
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 print:py-0">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink print:hidden">
        Tables &amp; QR codes
      </h1>

      <form onSubmit={handleCreer} className="mt-6 flex gap-2 print:hidden">
        <input
          type="number"
          placeholder="Numéro de table"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          className="rounded border border-cosy-ink/20 px-3 py-2"
        />
        <button type="submit" className="rounded-pill bg-cosy-pink px-4 py-2 font-bold text-white">
          Créer
        </button>
      </form>

      <button
        onClick={() => window.print()}
        className="mt-4 rounded-pill border border-cosy-pink px-4 py-2 font-bold text-cosy-pink print:hidden"
      >
        Imprimer tous les QR codes
      </button>

      <div className="mt-8 grid grid-cols-2 gap-6 print:grid-cols-1">
        {tablesAvecQr.map(({ table, qrDataUrl }) => (
          <div key={table.id} className="rounded-lg border border-cosy-pink/20 p-4 text-center">
            <p className="font-display font-extrabold">Table {table.numero}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR code table ${table.numero}`} className="mx-auto mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify in the browser**

Log in, open `http://localhost:3000/admin/tables`. Confirm the seeded "Table 1" shows a scannable QR code, scan it with a phone camera and confirm it opens `/commander/table-1`. Create table `2`, confirm it appears after reload with its own QR code. Click "Imprimer tous les QR codes", confirm the print preview hides the form/buttons and shows only the QR cards.

- [ ] **Step 9: Commit**

```bash
git add lib/qrcode.ts lib/qrcode.test.ts app/admin/tables package.json package-lock.json
git commit -m "Add table creation and printable QR code generation"
```

---

## Task 26: Deployment

This task is mostly manual steps the site owner (or whoever holds the Vercel/domain accounts) must perform — account creation and domain purchase aren't actions an agent should take on someone else's behalf.

- [ ] **Step 1 (manual): Push the repository to GitHub**

Create a new GitHub repository (e.g. `cosy-montbeliard-website`), then:

```bash
git remote add origin <repository-url>
git push -u origin main
```

- [ ] **Step 2 (manual): Deploy to Vercel**

1. Go to `https://vercel.com`, sign up/log in, click "Add New… → Project", import the GitHub repository.
2. Under "Environment Variables", add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (same values as `.env.local`), and `NEXT_PUBLIC_SITE_URL` set to the production domain (Step 3 below) or the default `*.vercel.app` URL if the custom domain isn't ready yet.
3. Click "Deploy".

- [ ] **Step 3 (manual): Connect the domain**

1. Buy the domain (e.g. `cosy-montbeliard.fr`) through any registrar.
2. In the Vercel project, go to **Settings → Domains**, add the domain, and follow the DNS instructions shown (usually adding an `A` or `CNAME` record at the registrar).
3. Once DNS propagates, update `NEXT_PUBLIC_SITE_URL` in Vercel's environment variables to the final domain, and redeploy so QR codes (Task 25) point at the production URL.

- [ ] **Step 4 (manual): Re-run the kitchen/table verification against production**

Repeat the checks from Task 20 and Task 22 (place an order on the live site, watch it appear on `/cuisine`, advance its status, confirm the customer page updates) against the deployed URL before printing and sticking QR codes on real tables.

---

## Self-Review Notes

- **Spec coverage:** Accueil/Menu/Contact (Tasks 13–15), table QR ordering (Tasks 18–20), kitchen screen (Task 22), admin menu management (Tasks 23–24), QR generation/printing (Task 25), Pop & Gourmand visual identity (Task 2), no online payment (not implemented anywhere — correct per spec), no "call staff" button (not implemented — correct per spec), error handling for lost connection (Task 19's `erreur` state) and offline kitchen screen (Postgres persistence, no in-memory-only state) are covered.
- **Type consistency checked:** `StatutCommande` values (`recue`/`en_preparation`/`prete`) match across `lib/orderStatus.ts`, `supabase/schema.sql`'s check constraint, and every API route. `CartItem` fields (`produitId`, `nom`, `prixCentimes`, `quantite`) match between `lib/cart.ts` and `CommandeClient.tsx`'s usage. The `/api/commandes` request body shape (`tableId`, `lignes[].{produitId,nom,prixCentimes,quantite}`) matches between the route implementation, its test, and the client's `fetch` call.
- **Menu seed data gap:** `Wraps` and `Glaces Artisanales` categories are created with no products in Task 6 (source screenshots ran out before their items rendered) — flagged explicitly in that task rather than invented. All other 12 categories (~90 products) are seeded from the real menu, transcribed across 43 screenshots.
