# CLAUDE.md — CRM & Suivi de chantiers BTP

Document de contexte fondateur. Claude Code le lit à chaque session. Il fait autorité sur l'architecture, les conventions et les garde-fous. En cas de doute, suivre ce document avant toute habitude par défaut.
Lis toujours le cadrage-crm-chantier.md avant de commencer une session. 
---

## 1. Le produit

SaaS de **CRM + suivi de chantiers** pour le BTP (cible TPE → PME). Principe directeur : **zéro ressaisie** — la donnée commerciale (contact, affaire) se prolonge en exécution (chantier) sans être retapée.

Chaîne métier : `Société/Contact → Affaire (pipeline) → [gagnée] → Chantier → Rapports + Pointage`.

**Affaire et Chantier sont deux entités distinctes reliées.** Une affaire gagnée se convertit en chantier (pré-remplissage), une affaire perdue ne crée rien, un client peut avoir plusieurs chantiers.

Le modèle de données complet (entités, champs, relations) vit dans `docs/cadrage-crm-chantiers-mvp.md`. **Le consulter avant toute feature touchant la base.**

### Hors périmètre — NE PAS implémenter
Facturation, devis, étude de prix/chiffrage, situations de travaux, recouvrement, factures fournisseurs, export paie. Si une demande de feature dérive vers ces sujets, s'arrêter et demander confirmation.

> **DANS le périmètre (validé) :** les **dépôts/véhicules** (emplacements de l'organisation, cf. cadrage v1.2) et le **matériel unitaire** — parc d'outillage & machines suivi comme **actifs individuels** (1 ligne = 1 machine, n° de série, localisation, entretien, transferts ; cf. cadrage v1.3).
---

## 2. Stack & outillage

- **Runtime / package manager : Bun** (pas npm/pnpm/yarn).
- **Next.js 16**, App Router, React Server Components par défaut.
- **TypeScript strict** partout.
- **Drizzle ORM** + **PostgreSQL** (Supabase comme hébergeur Postgres + Storage).
- **Better-Auth** + plugin **organization** pour l'auth et le multi-tenant.
- **Tailwind** + composants UI du boilerplate (Base UI / Shadcn selon la config du repo — ne pas mélanger deux systèmes de composants).
- **Zod** pour toute validation d'entrée.
- **Supabase Storage** pour photos et documents (URLs signées).

### Commandes (Bun) — scripts réels du `package.json`
```bash
bun install                     # dépendances
bun run dev                     # serveur de dev (next dev)
bun run build                   # build prod (next build)
bun run generate-migration      # générer une migration depuis le schéma (drizzle-kit generate)
bun run migrate:local           # appliquer les migrations en local (scripts/migrate.ts)
bun run migrate:prod            # appliquer les migrations en prod
bunx @better-auth/cli migrate   # créer/MAJ les tables Better-Auth (org, member, invitation…)
bun run lint                    # lint (biome lint)
bun run format                  # format (biome format --write)
bun run biome:check             # lint + format combinés (biome check)
bun run typecheck               # vérif types (tsc --noEmit)
```
**Lint/format = Biome** (`biome.json`), pas ESLint/Prettier. Drizzle : schéma dans `src/database/schema.ts`, migrations dans `./migrations/` (cf. `drizzle.config.ts`).
Toujours lancer `typecheck` + `lint` avant de considérer une feature terminée.

---

## 3. Architecture monorepo (API-first)

Objectif : du code métier réutilisable web **et** futur mobile natif. La logique ne vit jamais dans les composants ni dans les routes — elle vit dans des packages partagés. Routes et Server Actions ne sont qu'une **façade fine** au-dessus de la couche services.

Structure cible (Bun workspaces) :
```
apps/
  web/                 # app Next.js (UI + façade routes/actions)
  mobile/              # (V2) app mobile native, consomme les mêmes services/API
packages/
  db/                  # schémas Drizzle + client db + migrations
  auth/                # config Better-Auth partagée (serveur + client)
  core/                # logique métier : services par domaine (crm, chantiers…)
  validation/          # schémas Zod partagés (entrées/sorties)
  types/               # types TS partagés dérivés du schéma db et de Zod
```

> ⚠️ **État actuel vs cible.** Le repo part du boilerplate **ShipFree** : application Next.js unique sous `src/` (alias `@/*` → `src/*`), **sans** workspaces ni `apps/`/`packages/`. La structure monorepo ci-dessus est l'**objectif** vers lequel migrer, pas l'état présent. De même, le routage `[locale]`/i18n du boilerplate a été retiré, et `docs/cadrage-crm-chantiers-mvp.md` n'existe pas encore (créer le cadrage avant de s'appuyer dessus). Quand un point de ce document parle de `packages/core`, `packages/db`, etc., l'appliquer à l'emplacement actuel équivalent (`src/lib/*`, `src/database/*`) tant que la migration monorepo n'est pas faite.

Règles :
- Un **service** = une fonction métier pure, qui reçoit le contexte (`{ organizationId, member }`) en argument et ne lit jamais la session elle-même. Testable sans HTTP.
- Les Server Actions / Route Handlers récupèrent la session, en extraient le contexte, appellent un service, renvoient le résultat. Rien de plus.
- Les types traversent les couches via `packages/types` ; pas de redéfinition locale.

---

## 4. Multi-tenant & authentification

Le multi-tenant est la contrainte la plus critique du projet. Une fuite inter-organisation est un bug de sécurité bloquant.

### Plugin organization
- Les tables `organization`, `member`, `invitation` et le champ `session.activeOrganizationId` sont **fournis par le plugin Better-Auth `organization`**. Ne PAS les recréer dans le schéma Drizzle métier.
- `session.activeOrganizationId` est la **primitive centrale** : c'est l'organisation dans laquelle l'utilisateur agit. Tout accès métier s'y rattache.
- Gestion des membres et invitations : passer par les API du plugin (`inviteMember`, `addMember`, `updateMemberRole`, `removeMember`), pas par des écritures Drizzle directes.

### Rôles métier
Définis comme **rôles custom** du plugin (access control), en plus des rôles natifs :
- `admin` (mappé sur le owner/admin de l'org) — accès complet.
- `commercial` — CRM complet, lecture chantiers.
- `conducteur` — chantiers complets, lecture CRM.
- `terrain` — rapports + pointage sur chantiers assignés, lecture limitée.

Les permissions sont vérifiées dans la couche service (jamais seulement côté UI).

### Cloisonnement — règle d'or
**ShipFree utilise Better-Auth, pas Supabase Auth.** Les RLS Supabase basées sur `auth.uid()` ne fonctionnent donc PAS automatiquement (la session Better-Auth n'est pas dans le JWT Supabase). Conséquence :

- Le cloisonnement de référence est **applicatif et obligatoire**. **Chaque** requête Drizzle sur une table métier filtre sur `organizationId = activeOrganizationId`.
- Centraliser : un helper `getOrgContext()` extrait `{ organizationId, member, role }` de la session et **toute** fonction service le reçoit. Aucune requête métier ne s'exécute sans ce filtre.
- Ne jamais accepter un `organizationId` venant du client : toujours le dériver de la session côté serveur.
- (Défense en profondeur, optionnel) Si on ajoute du RLS Postgres plus tard, il faudra propager le contexte org via `set_config`/rôle dédié, pas via `auth.uid()`.

---

## 5. Conventions base de données (Drizzle)

- Toute table métier porte : `id` (uuid pk), `organizationId` (fk, **non null**, indexée), `createdAt`, `updatedAt` (timestamptz). Exceptions : les tables du plugin Better-Auth.
- Nommage tables : `snake_case` singulier (`deal`, `site_report`, `time_entry`). Colonnes : `camelCase` côté Drizzle / `snake_case` en base.
- Enums applicatifs (stage, status, relationType, role…) définis comme enums Postgres via Drizzle, pas des `text` libres.
- Clés étrangères explicites avec `references()` et stratégie `onDelete` réfléchie (ex. supprimer un chantier ne doit pas casser ses rapports silencieusement).
- **Suppression** : privilégier le soft-delete (`deletedAt`) sur les entités à valeur métier (affaires, chantiers) ; filtrer `deletedAt is null` par défaut.
- Index sur `organizationId` + colonnes de filtre fréquentes (`status`, `stage`, `siteId`).
- Toute modif de schéma → `bun drizzle-kit generate` puis migration versionnée commitée. Jamais de modif manuelle en base.

---

## 6. Couche métier & validation

- Logique dans `packages/core`, organisée par domaine : `core/crm/*`, `core/chantiers/*`.
- Chaque entrée externe (Server Action, Route Handler) valide ses données avec un schéma **Zod** de `packages/validation` avant d'appeler un service. Pas de données non validées dans un service.
- Les services renvoient des résultats typés ; les erreurs métier sont des erreurs typées (pas de `throw` de strings).
- Pas d'accès db hors de `packages/db` et `packages/core`. Un composant ou une route n'importe jamais Drizzle directement.

---

## 7. Conventions Next.js

- **Server Components par défaut.** `"use client"` uniquement quand il y a interactivité (kanban drag & drop, formulaires, saisie terrain).
- **Mutations → Server Actions** par défaut. **Route Handlers** réservés à ce qui doit être une API consommable par le futur mobile ou des webhooks.
- Récupération de données : dans les Server Components / services, jamais de `fetch` interne vers ses propres routes.
- Routes protégées via middleware ; vérifier session **et** appartenance à l'org active.
- Gestion d'erreurs : `error.tsx` / `not-found.tsx` par segment ; états de chargement avec `loading.tsx` / Suspense.

---

## 8. UI — mobile-first & PWA

- **Mobile-first non négociable.** Chaque écran est conçu pour le smartphone d'abord (saisie de rapport et pointage sur le terrain), puis étendu au desktop. Tester systématiquement en viewport étroit.
- **PWA dès le départ** : manifest, service worker, installable. Le mode offline (saisie hors connexion) est V2 mais l'architecture ne doit pas l'empêcher.
- Un seul système de composants (celui du boilerplate). Composants accessibles, états de chargement et d'erreur explicites.
- Écrans terrain (rapport, pointage) : formulaires courts, gros boutons tactiles, photo depuis l'appareil.

---

## 9. Conventions de code

- TypeScript strict, pas de `any` (utiliser `unknown` + narrowing si nécessaire).
- Nommage : composants `PascalCase`, fonctions/variables `camelCase`, fichiers de composants `PascalCase.tsx`, autres `kebab-case`.
- Fonctions courtes et nommées par intention. Commentaires seulement pour le « pourquoi », pas le « quoi ».
- Pas de secret en dur ; tout via variables d'environnement (documentées dans `.env.example`).

---

## 10. Méthode d'exécution (feature par feature)

Le développement avance **une feature à la fois**. Pour chaque feature :

1. Lire la section concernée du cadrage (`docs/cadrage-crm-chantiers-mvp.md`) et identifier les entités touchées.
2. Schéma db d'abord : ajouter/modifier les tables Drizzle, générer + appliquer la migration.
3. Validation Zod + service métier dans `packages/core`, avec contexte org obligatoire.
4. Façade : Server Action ou Route Handler minimal.
5. UI mobile-first.
6. `bun run typecheck` + `bun run lint`, vérifier le cloisonnement org sur tous les accès db.
7. S'arrêter et rendre la main pour validation avant de passer à la feature suivante.

### Ordre des features MVP
1. Auth + organisation + invitation de membres + rôles.
2. Sociétés & contacts (CRUD + fiche 360).
3. Affaires + pipeline kanban + gagnée/perdue.
4. Activités & tâches (rappels, vue « mes tâches du jour »).
5. Chantiers (fiche + conversion depuis affaire gagnée).
6. Rapports de chantier journaliers + photos.
7. Pointage des heures.
8. Dashboards (vue commerciale + vue chantiers).

---

## 11. Garde-fous (interdits)

- ❌ Exécuter une requête métier sans filtre `organizationId`.
- ❌ Accepter un `organizationId` fourni par le client.
- ❌ Recréer les tables `organization`/`member`/`invitation` (elles viennent du plugin).
- ❌ Mettre de la logique métier dans un composant ou une route.
- ❌ Importer Drizzle hors de `packages/db` / `packages/core`.
- ❌ Implémenter quoi que ce soit du périmètre exclu (facturation, devis, stock…) sans validation explicite.
- ❌ Compter sur les RLS Supabase `auth.uid()` pour le cloisonnement.
- ❌ Modifier la base à la main au lieu d'une migration Drizzle versionnée.
