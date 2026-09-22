# Site web Cosy Montbéliard — vitrine + commande à table par QR code

**Date :** 2026-09-22
**Statut :** Approuvé, prêt pour plan d'implémentation

## Contexte

Cosy (Cosy Café & Cie) est un café/pâtisserie à Montbéliard (donuts, bagels, crêpes, milkshakes, pâtisseries maison). Ce projet est le premier des trois systèmes identifiés pour l'établissement (site web, commande à table QR, carte de fidélité) — les deux autres seront traités séparément par la suite.

En cours de discussion, il est apparu que la "commande en ligne" souhaitée sur le site correspond en réalité au besoin de commande à table par QR code : un seul système, pas deux projets distincts.

## Périmètre

Inclus dans ce projet :
- Site vitrine public (Accueil, Menu, Contact & horaires)
- Commande à table via QR code (parcours client)
- Écran cuisine temps réel (parcours personnel)
- Panneau d'administration (gestion du menu + génération des QR codes par table)

Explicitement hors périmètre (phases futures) :
- Carte de fidélité
- Paiement en ligne (le règlement se fait au comptoir)
- Livraison / click & collect à emporter
- Bouton "appeler le personnel"
- Pages additionnelles (galerie, à propos) — non retenues pour l'instant

## Identité visuelle

Direction retenue : **"Pop & Gourmand"**, fidèle à l'identité actuelle de l'enseigne.
- Rose vif dominant (`#E9148C` — couleur du logo/néon existant)
- Typographies épaisses, grand format, très affirmées
- Photos produits pleine largeur (donuts, pâtisseries, milkshakes)
- Ambiance énergique et gourmande, cohérente avec la façade et le logo existants

Écarté : direction "Cosy Chic" (rose poudré/serif, plus premium) et "Warm Café" (tons bois/crème, rose en accent) — le client a choisi de rester fidèle à l'identité visuelle déjà en place en magasin.

## Architecture technique

- **Frontend/Backend** : Next.js (React) — un seul projet couvrant site vitrine, page de commande, écran cuisine et admin
- **Base de données** : Supabase (Postgres), avec ses capacités temps réel (Realtime) pour propager les mises à jour de statut sans rafraîchissement de page
- **Hébergement** : Vercel pour l'application, Supabase pour la base de données (offres gratuites suffisantes au démarrage)
- **Domaine** : à réserver par le client (ex. `cosy-montbeliard.fr`) — achat effectué par le client lui-même
- **QR codes** : une URL unique par table (`/commander/table-{numero}`), générée et imprimable (PDF) depuis l'admin

## Modèle de données (aperçu)

- `categories` — nom, ordre d'affichage
- `produits` — nom, description, prix, catégorie, disponibilité (bool), photo
- `tables` — numéro, identifiant unique (utilisé dans l'URL du QR code)
- `commandes` — table associée, horodatage, statut (`reçue` / `en_préparation` / `prête`), lignes de commande (produit, quantité, options)

Le menu public (page "Menu" du site vitrine) et la page de commande à table lisent la **même** table `produits` : un produit marqué indisponible depuis l'admin disparaît immédiatement des deux.

## Parcours utilisateurs

### Client (site vitrine)
1. Arrive sur l'Accueil (hero, présentation, catégories, appel à l'action)
2. Consulte le Menu (lecture seule, pas de commande possible depuis cette page)
3. Consulte Contact & horaires (adresse, carte, horaires, téléphone)

### Client (commande à table)
1. Scanne le QR code de sa table → arrive directement sur le menu de commande, table déjà identifiée
2. Parcourt les catégories, ajoute des produits au panier (avec options simples si besoin)
3. Valide sa commande → part immédiatement en cuisine, statut initial **Reçue**
4. La page se met à jour automatiquement : **Reçue → En préparation → Prête** (via Supabase Realtime, pas de rafraîchissement manuel)
5. Peut passer une nouvelle commande depuis la même table à tout moment sans rescanner

### Personnel (écran cuisine)
- Écran dédié affichant les commandes entrantes en temps réel, groupées par table, avec heure d'arrivée
- Changement de statut en un clic (Reçue → En préparation → Prête), répercuté immédiatement côté client
- Les commandes marquées prêtes sortent de la vue active

### Personnel (admin)
- CRUD produits/catégories (nom, prix, description, disponibilité, photo)
- Génération et impression des QR codes par table
- Historique simple des commandes du jour

## Gestion des cas particuliers

- Produit rendu indisponible pendant qu'un client a le menu ouvert → désactivé en direct côté client, sans rechargement
- Perte de connexion internet côté client au moment de valider → message d'erreur clair + possibilité de renvoyer la commande
- Plusieurs commandes sur une même table (ex. entrée puis dessert) → accumulées normalement, pas de notion de "table occupée" bloquante
- Écran cuisine hors ligne temporairement → les commandes restent en base (Postgres) et réapparaissent à la reconnexion, aucune perte

## Vérification

Avant mise en production : test du parcours complet (scan QR → commande → réception cuisine → changement de statut → mise à jour visible côté client) sur mobile réel et sur l'écran cuisine.

## Étapes suivantes (hors de ce projet)

- Système de carte de fidélité personnalisable
- Le reste (design, ce site) sert de socle : la carte de fidélité pourra réutiliser la même base Supabase et le même compte client si besoin, à concevoir en temps voulu
