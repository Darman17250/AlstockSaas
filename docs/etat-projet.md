# État du projet & passation de session

> **But de ce document** : permettre à une nouvelle session Claude de reprendre le développement **sans re-explorer le repo**. À lire en premier, avec `CLAUDE.md` et `docs/cadrage-crm-chantiers-mvp.md`. À tenir à jour à la fin de chaque feature.

Dernière mise à jour : fin **Activités & tâches** (page /taches onglets Mes tâches/Équipe/Calendrier, filtre par salarié, sections Tâches sur fiches affaire & client). Prochaine étape : **Chantiers** (cf. §10).

---

## 1. Où on en est

| Étape | Statut |
|---|---|
| Cadrage modèle de données (`docs/cadrage-crm-chantiers-mvp.md`) | ✅ validé v1 |
| Phase 0 — Fondations multi-tenant | ✅ terminée & vérifiée |
| Gestion membres & invitations (Équipe) | ✅ terminée & vérifiée (E2E curl : invite→signup→accept) |
| **F1 — Sociétés & contacts** | ✅ **terminée & validée** (navigateur OK) |
| **F2 — Affaires + pipeline kanban + gagnée/perdue** | ✅ **terminée & validée** (`typecheck`/`lint` ✅, navigateur OK) |
| ↳ Extension : documents d'affaire (Supabase Storage) | ✅ **terminée & validée** (upload/download/suppression OK) |
| ↳ Extension : section « Affaires » sur la fiche client | ✅ terminée |
| **Activités & tâches** (page /taches + calendrier + sections fiches) | ✅ **terminée & validée** (voir §8) |
| ↳ Communications sur fiche client (faite hors session) | ✅ présente (audit léger conseillé, voir §8) |
| **Chantiers** (prochaine feature MVP) | ⏳ à faire — prompt prêt en §10 |
| Rapports · Pointage · Dashboards | ⏳ à faire |

> ⚠️ Numérotation des features **non fiable** dans le repo : certains commentaires de F2 parlent de « conversion F5 » pour les chantiers. Se référer à l'**ordre nommé** de `CLAUDE.md §10` (Affaires → **Activités & tâches** → Chantiers → Rapports → Pointage → Dashboards), pas aux numéros.

Vérifs Phase 0 passées : `typecheck` ✅ · `lint` ✅ (1 seul `info` préexistant dans `lemonsqueezy.ts`, non lié) · `build` ✅ · migration appliquée sur Supabase (19 tables) ✅ · init Better-Auth + matrice de permissions testée au runtime ✅.

**Parcours validés en navigateur** : signup → onboarding → app, F1 (clients/contacts), F2 (affaires/pipeline/documents), Activités & tâches (page /taches, calendrier, sections fiches, filtre salarié). **Recommandé mais non confirmé** : un **test anti-fuite inter-org** systématique (2 orgs ; vérifier qu'une org ne voit jamais clients/affaires/documents/tâches de l'autre, y compris accès direct `/affaires/[id]`, `/api/affaires/...`). Le cloisonnement est codé (filtre `organizationId` partout) mais ce test E2E reste à jouer explicitement.

---

## 2. Environnement — pièges importants

- **Bun n'était pas installé** sur la machine ; installé via le script officiel dans `~/.bun/bin`. **`bun` n'est PAS dans le PATH** des shells non-interactifs.
  - Utiliser **`~/.bun/bin/bun ...`** ou faire `export PATH="$HOME/.bun/bin:$PATH"` en début de commande.
  - ⚠️ `bun run migrate:local` échoue (le script ré-invoque `bun`). Lancer directement : `export PATH="$HOME/.bun/bin:$PATH"; ~/.bun/bin/bun run ./scripts/migrate.ts`.
- **`.env` existe** (gitignoré). Contient `DATABASE_URL` Supabase (connexion directe `db.<ref>.supabase.co:5432`), `BETTER_AUTH_SECRET` (généré), URLs localhost, `SUPABASE_URL`, et désormais **`SUPABASE_SERVICE_ROLE_KEY`** + **`SUPABASE_STORAGE_BUCKET=affaire-documents`** (stockage configuré, cf. §9).
  - 🔐 Le mot de passe DB a été collé en clair dans le chat → **à régénérer** (Supabase → Settings → Database → Reset password) puis mettre à jour `.env`.
  - **Ne PAS** mettre `BILLING_ENABLED` / `EMAIL_VERIFICATION_ENABLED` en string dans `.env` : le schéma `src/config/env.ts` attend un `z.boolean()` (pas de coercion) → laisser au défaut `false`.
  - **Stockage Supabase opérationnel** : bucket **privé** `affaire-documents` créé, clé **`service_role` (secrète, pas `anon`)** dans `.env`. ⚠️ `src/config/env.ts` doit lister `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_STORAGE_BUCKET` dans `server` **et** `runtimeEnv` (sinon non lues). ⚠️ `bun -e` ne charge PAS `.env` (contrairement à `bun run` / Next) → pour un script de vérif, parser `.env` à la main.
- **Client DB singleton (fait)** : `src/database/index.ts` met le client `postgres` en cache sur `globalThis` en dev → le HMR n'accumule plus de connexions (saturation du pool) ni de timers `max_lifetime` (qui causaient des `TimeoutNegativeWarning`). En cas de saturation résiduelle, redémarrer le dev reste le remède.
- **Convention Next 16** : utiliser **`proxy.ts`** (racine), PAS `middleware.ts` (déprécié).
- **Port de dev figé sur 3001** (`package.json` → `next dev -p 3001`) car un autre projet (`/Documents/Alstock`) occupe le 3000. `.env` URLs alignées sur 3001. Le client auth (`auth-client.ts`) cible l'origine du navigateur en dev (same-origin, pas de CORS).
- **Bugs cookies du boilerplate corrigés** dans `auth.ts` : `crossSubDomainCookies.enabled` et `useSecureCookies` étaient à `!isProd` (donc actifs en dev) → cookie `Domain=.shipfree.app` + `__Secure-` rejeté par le navigateur sur localhost → toutes les routes auth post-login en **401**. Remis à `isProd`. ⚠️ En prod, mettre le vrai domaine dans `crossSubDomainCookies.domain`.
- **Inscription** : `register-form` ne redirige vers `/verify` que si `EMAIL_VERIFICATION_ENABLED` (sinon → app directement, l'utilisateur est auto-connecté). En dev, l'OTP n'est de toute façon pas envoyé (`EMAIL_PROVIDER=log`).

---

## 3. Décisions & conventions verrouillées

- **Architecture** : app Next **unique** sous `src/` (pas de monorepo pour l'instant). Le « monorepo cible » de `CLAUDE.md` est reporté avant le mobile. Mapping : `packages/core`→`src/services`, `packages/db`→`src/database`, `packages/validation`→`src/validation` (à créer en F1).
- **Storage** : Supabase Storage (R2 du boilerplate abandonné).
- **Langue** : **français** (UI + routes : `/clients`, `/affaires`, `/chantiers`, `/taches`, `/equipe`).
- **Billing SaaS** : différé (code présent, non câblé).
- **Modèle client** : entité unique **`client`** avec `type = societe | particulier` ; `relationType = client | prestataire` (« prospect » = dérivé du pipeline, pas un champ). Voir cadrage.
- **IDs** : tables Better-Auth (`organization`/`member`/`user`) en **`text`** ; tables métier en **`uuid`**. Donc tout FK vers org/member est `text`, FK entre tables métier est `uuid`.

---

## 4. Carte des fichiers Phase 0 (ce qui a été créé/modifié)

**Schéma & DB**
- `src/database/schema.ts` — ajouté : tables plugin org (`organization`, `member`, `invitation`) + `session.activeOrganizationId` ; 11 enums métier ; 8 tables métier (`client`, `contact`, `deal`, `activity`, `site`, `site_report`, `site_report_photo`, `time_entry`) + relations.
  - FK circulaires `deal.siteId` ↔ `site.dealId` : annoter le callback `references((): AnyPgColumn => ...)` (sinon erreur TS d'inférence circulaire).
  - `site_report` : index unique **partiel** `(siteId, reportDate) WHERE deleted_at is null`.
- `migrations/0000_busy_doomsday.sql` — baseline (19 tables). **Appliquée**.

**Auth & multi-tenant**
- `src/lib/auth/permissions.ts` — access-control : `ac`, rôles (`owner`,`admin`,`member`,`commercial`,`conducteur`,`terrain`), `ASSIGNABLE_ROLES`, helper **`can(role, resource, action)`** (avec cast `as typeof owner` + `as never`, nécessaire car l'union de signatures `authorize` n'est pas appelable).
- `src/lib/auth/auth.ts` — `organization({ ac, roles, ... })` ajouté.
- `src/lib/auth/auth-client.ts` — `organizationClient({ ac, roles })` ajouté.
- `src/lib/auth/org-context.ts` — **`getOrgContext()`** (lecture du membre via DB), `requireOrgContext()`, `requirePermission()`, erreurs typées `UnauthorizedError`/`ForbiddenError`. **`import 'server-only'`** en tête. Fallback : si `activeOrganizationId` est null, utilise la dernière appartenance du membre (évite la redirection onboarding intempestive).
- `src/lib/auth/auth.ts` — **`databaseHooks.session.create.before`** : définit `activeOrganizationId` (dernière org du membre) à chaque connexion. ⚠️ Sans ça, Better-Auth laisse `activeOrganizationId` null après login → un membre existant est renvoyé vers `/onboarding`.
- `proxy.ts` (racine) — garde de session sur les routes app (matcher sur `/dashboard`, `/onboarding`, `/clients`, …). Utilise `getSessionCookie(req, { cookiePrefix: APP_COOKIE_NAME })`.

**Gestion d'équipe (membres & invitations)**
- `auth.ts` — callback `sendInvitationEmail` (envoie le mail + logge le lien `/accept-invitation/<id>` ; en dev EMAIL_PROVIDER=log → lien visible dans la console serveur uniquement).
- `src/database/schema.ts` — ⚠️ la table `invitation` doit inclure **`createdAt`** (Better-Auth l'exige, sinon 500 « field createdAt does not exist »). Migration `0001_melodic_black_bird.sql` (ADD COLUMN). Appliquée.
- `src/lib/auth/permissions.ts` — `ROLE_LABELS` (FR).
- `src/app/(main)/equipe/page.tsx` (lecture DB members+invitations) + `_components/team-management.tsx` (invite / changement de rôle / retrait / annulation via `client.organization.*`). Mutations réservées owner/admin. On ne touche pas au rôle `owner` ni à soi-même.
- `src/app/accept-invitation/[id]/page.tsx` + `accept-invitation.tsx` — accept/reject ; si pas connecté → `/login?callbackUrl=…`. Seuls owner/admin ont la permission `invitation:create` (via leurs statements natifs) ; commercial/conducteur/terrain ne peuvent pas inviter.
- `src/app/onboarding/` — la page liste aussi les **invitations en attente** pour l'email connecté (`pending-invitations.tsx`, bouton « Rejoindre ») en plus de la création d'org. ⚠️ Better-Auth exige que l'email connecté == email invité **exactement** pour accepter (sinon l'invitation n'apparaît pas / accept refusé).

**UI / shell**
- `src/app/onboarding/page.tsx` + `onboarding-form.tsx` — création de la 1re organisation (hors guard `(main)`). `client.organization.create` puis `setActive`.
- `src/app/(main)/layout.tsx` — guard : session→`/login`, pas d'org active→`/onboarding`, sinon rend le shell (SidebarProvider + AppSidebar + header).
- `src/app/(main)/_components/app-sidebar.tsx` — nav **filtrée par rôle** via `can(...)` ; déconnexion. ⚠️ `SidebarMenuButton` (Base UI) n'a **pas** `asChild` : utiliser `render={<Link href=... />}`.
- `src/app/(main)/_components/page-placeholder.tsx` + pages stub `clients|affaires|chantiers|taches|equipe/page.tsx`.
- `src/app/(main)/dashboard/page.tsx` — réécrit en FR (raccourcis).

---

## 5. Comment lancer

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run dev                 # serveur de dev
bun run typecheck           # tsc --noEmit
bun run lint                # biome lint
bun run build               # build prod
bun run generate-migration  # drizzle-kit generate (après modif schema.ts)
bun run ./scripts/migrate.ts  # applique les migrations (PAS `migrate:local`, cf. §2)
```

---

## 6. F1 « Sociétés & contacts » — livré

Décisions UX validées avec l'utilisateur : **pages dédiées** (pas de modales) pour créer/éditer · liste avec **recherche texte + filtres** type & relation · **CRUD contacts complet inline** dans la fiche client. Périmètre : `client` + `contact` uniquement (pas de migration : tables déjà en base).

**Validation Zod (`src/validation/` — créé en F1)**
- `client.ts` — `clientCreateSchema`/`clientUpdateSchema` (= `clientBaseSchema`), `clientListParamsSchema` (search/type/relationType + pagination `page`/`pageSize`). Enums dérivés du schéma Drizzle (`clientTypeEnum.enumValues`…). Helper `emptyToUndefined` : les chaînes vides des formulaires → `undefined`. Zod **v4** (`z.email()`, `z.uuid()`, `z.coerce.*`).
- `contact.ts` — `contactFieldsSchema`, `contactCreateSchema` (+ `clientId` uuid), `contactUpdateSchema`.

**Services (`src/services/` — créé en F1, `import 'server-only'`)**
- `crm/client.ts` — `listClients` (filtre `organizationId` + `deletedAt is null`, recherche `ilike` name/email/city, filtres, pagination, total via `count(*)::int`), `getClient` (client + `ownerName` + contacts non supprimés), `createClient`, `updateClient` (nettoie civility/siret selon `type`), `softDeleteClient`. Helper `assertOwnerInOrg` (un `ownerId` doit appartenir à l'org). Tous appellent `requirePermission(ctx,'client',…)`.
- `crm/contact.ts` — `createContact`/`updateContact`/`softDeleteContact` ; `assertClientInOrg` ; gestion **`isPrimary`** en **transaction** (repasse les autres contacts du client à `false`).
- `org/members.ts` — `listOrgMembers(ctx)` → `{id,name,role}` pour le sélecteur « commercial en charge ».
- `src/lib/auth/org-context.ts` — ajout de **`NotFoundError`** (en plus de `UnauthorizedError`/`ForbiddenError`).

**Façade — Server Actions (`src/app/(main)/clients/actions.ts`, `'use server'`)**
- `createClientAction`/`updateClientAction`/`deleteClientAction` + `createContactAction`/`updateContactAction`/`deleteContactAction`. Chacune : `requireOrgContext` → `schema.parse` → service → `revalidatePath` → renvoie `ActionResult` sérialisable (`{ok:true,data} | {ok:false,error}`). Helper `toError` mappe Zod + erreurs typées en messages FR.

**UI mobile-first (Base UI, FR)**
- `clients/page.tsx` — liste (Server Component, lit `searchParams` **Promise** en Next 16), pagination, état vide (`Empty`), bouton « Nouveau » conditionné par `can(role,'client','create')`.
- `clients/_components/` — `clients-filters.tsx` (recherche + 2 Select, état poussé dans l'URL), `clients-list.tsx`, `client-form.tsx` (formulaire adaptatif société/particulier, partagé création/édition).
- `clients/nouveau/page.tsx`, `clients/[id]/page.tsx` (fiche 360), `clients/[id]/modifier/page.tsx`.
- `clients/[id]/_components/` — `client-actions.tsx` (Modifier / Supprimer via `AlertDialog`), `contacts-section.tsx` (CRUD contacts inline en `Dialog`).
- `clients/loading.tsx` (Skeleton) + `clients/not-found.tsx`.
- `src/lib/crm/labels.ts` — libellés FR des enums (`CLIENT_TYPE_LABELS`, `RELATION_TYPE_LABELS`, `CIVILITY_LABELS`).

**⚠️ Pièges F1 à connaître**
- **Base UI `Select` n'affiche PAS le libellé tout seul** : `<SelectValue />` rend la *valeur* brute (id du membre, `societe`…). Il faut une fonction de rendu : `<SelectValue>{(value) => label}</SelectValue>`. Appliqué partout (type, relation, civilité, commercial, filtres).
- `Select.onValueChange` fournit `value: string | null` → pour un setter `string`, faire `(v) => setX(v ?? SENTINEL)`. Valeur « aucune » via sentinelle (`__none__`, `__all__`), jamais chaîne vide.
- Boutons-liens : `<Button render={<Link href=… />}>` (Base UI n'a pas `asChild`).
- Épuisement du pool Postgres en dev (`too many clients already` / `remaining connection slots reserved`) : connexion **directe** Supabase + HMR. **Fix durable appliqué** : client `db` singleton sur `globalThis` (`src/database/index.ts`). Si saturation résiduelle, redémarrer le dev.

**Reste à faire sur F1 (validation utilisateur)** : test navigateur + **anti-fuite inter-org** (2 orgs, org A crée un client → invisible/404 depuis org B : liste, accès direct `/clients/[id]`, actions update/delete).

---

## 7. F2 « Affaires + pipeline kanban » — livré

Décisions UX validées : **kanban drag & drop** (@dnd-kit) **+ menu ⋮ « Déplacer vers »** par carte (fallback tactile/clavier) · **onglets** Pipeline / Gagnées / Perdues · passage en « gagnée » marque l'affaire **et propose en option** de créer le chantier lié. Dépendance ajoutée : `@dnd-kit/core` (+ `sortable`/`utilities`, non utilisés au final). Table `deal` déjà en base (pas de migration pour le cœur F2).

**Validation** `src/validation/deal.ts` — `dealBase/Create/Update`, `dealListParams` (status/search/pagination), `dealStage`, `dealWon` (`createSite`), `dealLost` (`lostReason`). `status` **hors formulaire** (transitions = actions dédiées). `estimatedAmount` : `z.coerce.number()` côté form → stocké en **string** (colonne `decimal`).

**Service** `src/services/crm/deal.ts` (`server-only`) — `listDealsBoard` (status `en_cours`, groupé par stage côté UI), `listDeals` (onglets gagnées/perdues, paginé), `getDeal`, `createDeal`, `updateDeal`, `moveDealStage` (uniquement si `en_cours`), `markDealWon` (**transaction** ; si `createSite` → `requirePermission(site,create)` + insert `site` pré-rempli + `deal.siteId`), `markDealLost`, `reopenDeal`, `softDeleteDeal`, `listDealsForClient` (section fiche client). Helpers `assertClientInOrg`/`assertContactInOrg`/`assertOwnerInOrg`. **Filtre `organizationId` + `deletedAt is null` partout.**
- Ajouts F1 réutilisés : `listClientOptions` (client.ts), `listContactsForClient` (contact.ts).

**Façade** `src/app/(main)/affaires/actions.ts` — `create/update/delete/moveDealStage/markDealWon/markDealLost/reopen` + `clientContactsAction` (peuple le sélecteur de contact) + `deleteDealDocumentAction`. Pattern `ActionResult`+`toError`. `create/update` revalident aussi `/clients/${clientId}`.

**UI** `src/app/(main)/affaires/` — `page.tsx` (onglets via `?tab=`, server) ; `_components/` : `deal-board.tsx` (DnD, état optimiste + revert, colonnes scrollables mobile), `deal-card.tsx`, `deals-list.tsx`, `deal-filters.tsx`, `deal-form.tsx` (**client en `Combobox` recherchable**, contact chargé via action au changement de client), `won-dialog.tsx`/`lost-dialog.tsx` ; `nouveau/` (prefill `?clientId=`), `[id]/` (fiche + `_components/deal-actions.tsx`), `[id]/modifier/`, `loading.tsx`, `not-found.tsx`. Libellés `DEAL_*` + `formatDealAmount` dans `src/lib/crm/labels.ts`.
- Fiche client (`clients/[id]/page.tsx`) : section **« Affaires »** (`_components/deals-section.tsx`) + bouton « Nouvelle » → `/affaires/nouveau?clientId=`.

**⚠️ Pièges F2**
- `Combobox` Base UI : items `{value,label}` (label/value auto), `value` = item sélectionné (objet) ou `null`, `isItemEqualToValue={(a,b)=>a.value===b.value}`, `<ComboboxList>{(item)=>…}</ComboboxList>`.
- `@dnd-kit` : seules les **colonnes** sont droppables (cartes draggables only) → `over.id` = stage cible. `PointerSensor` `activationConstraint.distance:8` + `stopPropagation` sur le menu/lien pour que clic ≠ drag. `useEffect([deals])` resync l'état local après `router.refresh`.
- `markDealWon(createSite:true)` exige `site:create` → **commercial** (qui a `deal` complet) ne peut PAS créer le chantier ; admin/conducteur oui.

---

## 8. Activités & tâches — livré

Périmètre : les **tâches** = entité `activity` avec **`type='tache'`** (statut `a_faire`/`fait`/`annule`, `dueDate`, assigné, liens client/affaire/chantier ou autonome). **Aucune migration** (table `activity` déjà en base). Distinct des **communications** (déjà présentes, voir plus bas) qui utilisent les autres `type` (`appel/email/reunion/visite/note`) avec `status='fait'`.

> Décision clé : tâches = `type='tache'` uniquement (l'intitulé porte l'action, ex. « Appeler M. X »), pour ne pas mélanger avec les communications. `services/crm/task.ts` filtre **toujours** `type='tache'` ; `services/crm/activity.ts` filtre `inArray(type, COMMUNICATION_TYPES)`. Les deux ne se chevauchent jamais.

**Validation** `src/validation/task.ts` — `taskCreate/Update`, `taskStatus` (bascule case à cocher), `taskListParams` (assigneeId/status). Liens optionnels `clientId/dealId/siteId`.

**Service** `src/services/crm/task.ts` (`server-only`) — `listMyTasks` (assigné = membre courant), `listTeamTasks(params)` (filtres assigné+statut), `listTasksForDeal`, `listTasksForClient`, `createTask`, `updateTask`, `setTaskStatus`, `deleteTask` (**hard-delete**, activité = journal). `assertLinks` valide client/affaire/chantier/assigné dans l'org. **Filtre `organizationId` + `type='tache'` partout.** Perms `activity` : admin/commercial/conducteur complet, **terrain lecture seule**.
- Helpers d'options ajoutés : `listDealOptions` (deal.ts), `listSiteOptions` (`services/crm/site.ts`, **nouveau** — minimal, liste les chantiers existants pour le sélecteur ; le module Chantiers complet reste à faire).

**Façade** `src/app/(main)/taches/actions.ts` — `createTaskAction`/`updateTaskAction`/`setTaskStatusAction`/`deleteTaskAction`. Revalident `/taches` + fiches liées (`/affaires/[dealId]`, `/clients/[clientId]`).

**UI** `src/app/(main)/taches/` — `page.tsx` : onglets **Mes tâches** (groupées En retard / Aujourd'hui / À venir / Sans échéance / Terminées), **Équipe** (filtres assigné+statut via `TaskFilters`), **Calendrier**. `_components/` :
- `task-form-dialog.tsx` — `Dialog` réutilisable (Combobox client+affaire, Select chantier/assigné/statut, échéance). Props `locked` (lien imposé sur les fiches), `defaultDueDate` (clic jour calendrier). ⚠️ **réinitialise ses champs contrôlés via `useEffect([open, task])`** (le popup Base UI démonte son contenu à la fermeture, mais les `useState` du composant persistent → sans ce reset, l'édition gardait les valeurs précédentes).
- `task-row.tsx` — ligne avec case à cocher (toggle statut), échéance **rouge si en retard**, badges liens cliquables, éditer/supprimer. Exporte le type **`TaskView`** (dueDate ISO string).
- `tasks-view.tsx` (page, groupes), `tasks-section.tsx` (réutilisé sur fiches), `task-filters.tsx` (réutilisable : props `preserve` = params d'URL à garder, `showStatus`), `tasks-calendar.tsx` (vue mois, navigation, pastilles colorées par statut, clic jour → création échéance pré-remplie, bascule Mes/Équipe + filtre salarié quand Équipe).
- Sections **Tâches** sur fiche affaire (`affaires/[id]/page.tsx`, lien affaire+client pré-rempli) et fiche client (`clients/[id]/page.tsx`, lien client).
- Libellés `TASK_STATUS_LABELS` dans `src/lib/crm/labels.ts`.

**Communications (fait hors session, présent)** — `clients/[id]/_components/communications-section.tsx` + `services/crm/activity.ts` (`listClientCommunications`, `create/update/deleteCommunication`) + `validation/activity.ts` + actions dans `clients/actions.ts`. Cloisonne sur `organizationId` et filtre `COMMUNICATION_TYPES`. Audit léger conseillé mais cohérent avec les patterns.

**⚠️ Pièges Activités & tâches**
- Reset des champs du `Dialog` à l'ouverture (cf. `task-form-dialog`), sinon édition incorrecte.
- `dueDate` : input `date` (`YYYY-MM-DD`) → stocké en `timestamp` à **minuit local** (`new Date(\`${d}T00:00:00\`)`) ; relu via `toISOString()` puis reparsé en local côté client (le calendrier reconstruit la clé jour en **local**). Cohérent tant qu'on reste local des deux côtés.
- Calendrier : seules les **colonnes/jours** portent le clic de sélection ; les pastilles tâche font `stopPropagation` pour ouvrir l'édition.

---

## 9. Documents d'affaire (Supabase Storage) — livré

Extension de F2 : joindre images/PDF/Office à une affaire. Décisions : **Supabase Storage** (bucket privé `affaire-documents`), table **dédiée** `deal_document` (pas de table générique).

**Schéma** `deal_document` (`schema.ts`) : `dealId` (FK cascade), `storagePath`, `fileName`, `mimeType`, `size`, `uploadedById` (FK member set null), timestamps. Index `organizationId` + `dealId`. **Hard-delete** (la ligne + l'objet bucket sont supprimés ensemble, pas de `deletedAt`). Migration **`0002_blushing_brother_voodoo.sql` appliquée**.

**Stockage** `src/lib/supabase-storage.ts` (`server-only`) — `uploadObject`/`createSignedDownloadUrl`/`deleteObject`/`isStorageConfigured`/`StorageNotConfiguredError`, via API REST Supabase (`/storage/v1`) + `service_role`. **Jamais** exposer la clé au client.

**Service** `src/services/crm/deal-document.ts` — `listDealDocuments`, `uploadDealDocument` (valide mime ⊂ allowlist + taille ≤ 20 Mo ; chemin `org/affaire/uuid-nom`), `getDealDocumentDownload` (URL signée), `deleteDealDocument`. Perms : lecture `deal:read`, upload/suppression `deal:update`. Constantes dans `src/validation/deal-document.ts`.

**Façade** — **Route Handlers** (pas Server Action, pour gros fichiers + futur mobile) : `POST /api/affaires/[id]/documents` (upload, fichier transitant par le serveur) ; `GET /api/affaires/documents/[docId]` (redirige vers URL signée, `?download=1` force le téléchargement). Suppression via `deleteDealDocumentAction`.

**UI** — `affaires/[id]/_components/documents-section.tsx` (upload multi-fichiers via `fetch` FormData, liste, download, suppression `AlertDialog`). Bandeau « stockage non configuré » si `isStorageConfigured()` est faux.

**⚠️ Pièges documents**
- L'upload via `<Button render={<a/>}>` (icône seule) **fait échouer biome** (`useAnchorContent`) → utiliser un `<a>` stylé avec un `<span className='sr-only'>`.
- `fetch` body : passer un `Blob`/`File` (un `Uint8Array` n'est pas un `BodyInit`/`BlobPart` valide selon les types TS).
- Upload effectif testé E2E hors app (upload→sign→read→delete, tout 200). Le bucket doit être **privé** ; `SUPABASE_STORAGE_BUCKET` doit pointer sur le bon nom (un résidu `chantier-photos` avait été corrigé).

---

## 10. Prochaine étape — Chantiers

Feature suivante (CLAUDE.md §10, après Activités & tâches). Entité **`site`** déjà en base (cadrage §5) : `name`, `reference`, `clientId` (not null, **restrict**), `dealId` (set null), `status` (`prepa|en_cours|en_pause|termine|annule`), adresse (lignes/cp/ville/pays), dates (`startDate`/`endDate`/`actualStartDate`/`actualEndDate`), `conducteurId` (→ member), `description`. Soft-delete. **Pas de migration attendue** (table présente).

**Déjà en place à réutiliser** :
- `services/crm/site.ts` → `listSiteOptions` (à étoffer : `listSites`/`getSite`/`createSite`/`updateSite`/`softDeleteSite`).
- **Conversion affaire→chantier** déjà faite dans `markDealWon` (`services/crm/deal.ts`) : crée un `site` (name=titre, clientId, dealId, adresse copiée du client, status `prepa`) et pose `deal.siteId`. La fiche affaire affiche déjà un lien « Chantier lié » vers `/chantiers/[siteId]` (page à créer).
- `/chantiers` est encore un **stub** (`PagePlaceholder`). Sidebar déjà câblée (filtrée par rôle).

**Cycle imposé** : Zod (`src/validation/site.ts`) → service (`OrgContext`, filtre `organizationId`, `requirePermission(ctx,'site',…)`) → Server Actions (`ActionResult`+`toError`) → UI mobile-first. Réutiliser les patterns F1/F2 (liste filtrable + fiche 360 + form, Combobox client, sélecteur membre pour `conducteurId`, libellés FR dans `labels.ts`).

**Permissions `site`** : admin/conducteur = complet ; commercial = lecture ; terrain = lecture (chantiers assignés). Vérifier en couche service.

**Périmètre** : CRUD chantier + fiche + liste par statut + lien affaire d'origine + (optionnel) section Tâches/Documents sur la fiche chantier (les sections sont déjà réutilisables ; `task` supporte déjà `siteId`). **Rapports de chantier & pointage = features suivantes**, hors périmètre Chantiers.

### Infos à demander à l'utilisateur quand utile
- Nom de **branding** (remplace « ShipFree » dans `src/config/branding.ts` ; le cookie auth pointe encore `.shipfree.app` dans `auth.ts`).
