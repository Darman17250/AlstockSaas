# État du projet & passation de session

> **But de ce document** : permettre à une nouvelle session Claude de reprendre le développement **sans re-explorer le repo**. À lire en premier, avec `CLAUDE.md` et `docs/cadrage-crm-chantiers-mvp.md`. À tenir à jour à la fin de chaque feature.

Dernière mise à jour : fin **Rapports de chantier** (saisie terrain : météo/effectif/avancement/aléas + photos, unicité 1/jour) et **lien tâche ↔ équipement** (sélecteur + sections croisées). Avant : Chantiers (+ équipe, chat, stats) et tâches étoffées (responsable + co-assignés, pièces jointes, page détail). `typecheck`/`lint` ✅. Voir §10/§12. Prochaine étape : **Pointage des heures** (§13).

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
| **Parc d'équipements** (localisations · équipements · entretiens · QR · documents/photos) | ✅ **terminée & validée** (voir §11) |
| **Chantiers** (CRUD · fiche 360 · liste filtrable · conversion affaire) | ✅ **terminée & validée** (voir §10) |
| ↳ Extensions Chantiers : équipe assignée · discussion (chat) · stats fiche | ✅ terminée & validée |
| ↳ Extension Tâches : responsable + co-assignés · pièces jointes (images/docs) · page détail | ✅ terminée & validée |
| ↳ Lien tâche ↔ équipement (sélecteur + sections croisées) | ✅ terminée |
| **Rapports de chantier** (saisie terrain météo/effectif/avancement/aléas + photos) | ✅ **terminée** (voir §12) |
| Pointage · Dashboards | ⏳ à faire |

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

## 10. Chantiers (+ équipe, discussion, stats) & tâches étoffées — livré

Feature **Chantiers** complète + extensions, et extension transverse des **tâches**. `typecheck`/`lint` ✅, validé navigateur. Migrations **0003** (`site_document`), **0004** (`site_member`), **0005** (chat), **0006** (tâches) appliquées.

### Chantiers (entité `site`)
- **Validation** `src/validation/site.ts` (+ `site-document.ts`). Le `status` est **dans** le formulaire (pas de transitions dédiées, contrairement aux affaires).
- **Services** `src/services/crm/site.ts` (`listSites` filtrable + `getSite`/`createSite`/`updateSite`/`softDeleteSite` + asserts client/conducteur dans l'org) ; `site-document.ts` (images/docs, bucket privé `org/sites/<id>/`). Conversion affaire→chantier déjà dans `markDealWon`.
- **Façade** `chantiers/actions.ts` (CRUD chantier + docs + équipe + suppression message) ; routes `POST/GET /api/chantiers/[id]/documents`, download `/api/chantiers/documents/[docId]`.
- **UI** `chantiers/` : liste `page.tsx` (recherche + statut + client + pagination) + `_components/{sites-filters,sites-list,site-form}` ; fiche `[id]/page.tsx` (infos + lien **affaire d'origine**) ; `nouveau/`, `[id]/modifier/`, `loading`, `not-found` ; `[id]/_components/{site-actions,documents-section}`. Libellés `SITE_STATUS_LABELS`/`SITE_STATUSES`.
- **Permissions `site`** : admin/conducteur complet · commercial lecture · terrain lecture. ⚠️ Le raffinement « terrain = chantiers **assignés** » n'est **pas encore** appliqué au filtrage de liste (support de données = `site_member`, à brancher avec Pointage).

### Équipe assignée (`site_member`, n–n) — en plus du `conducteurId` unique
- `services/crm/site-member.ts` (`listSiteTeam`/`assignSiteMember` idempotent `onConflictDoNothing`/`removeSiteMember`). UI `[id]/_components/site-team-section.tsx` (ajout/retrait inline). Unicité `(siteId, memberId)`.

### Discussion / chat — `site_message` + `site_message_mention` + `site_message_attachment` (enum `message_attachment_kind`)
- `services/crm/site-message.ts` : `listSiteMessages` (chargement initial + incrémental `since`), `createSiteMessage` (transactionnel, upload pièces jointes), `deleteSiteMessage` (soft, **auteur ou `site:update`**), `getSiteMessageAttachmentDownload` (URL signée). Lecture/écriture = `site:read` (le terrain participe).
- Façade : `POST/GET /api/chantiers/[id]/messages` (polling via `?since=`), `GET /api/chantiers/messages/attachments/[attId]` (redirection vers URL signée → `src` des `<img>`/`<audio>`).
- UI `[id]/_components/{site-chat,chat-composer}.tsx` : **polling auto 5 s**, mentions `@salarié`/`#tâche` (pickers + chips), images, **vocaux via `MediaRecorder`**.

### Stats fiche chantier
- `[id]/_components/site-stats.tsx` : cartes Tâches (faites/total + %), Équipe, Messages, Documents (réelles) + **Avancement / Heures pointées « Bientôt »** (à compléter avec Rapports/Pointage).

### Tâches étoffées (entité `activity`, **global** — pas seulement chantier)
- Migration `0006` : `task_assignee` (co-assignés n–n ; le **responsable `assigneeId` est conservé**) + `task_document` (images **et** documents).
- `task.ts` : co-assignés gérés en transaction (create/update) ; « Mes tâches » & filtre Équipe = responsable **ou** co-assigné ; co-assignés joints à toutes les listes ; nouveau `getTask`. `task-document.ts` (perms `activity`, allowlist MIME réutilisée de `deal-document`).
- UI : `task-form-dialog` (co-assignés en chips) ; `task-row` (co-assignés « +N » + intitulé → fiche) ; **`/taches/[id]`** page détail + `_components/{task-detail-actions,task-documents-section}` (galerie images + liste docs) ; routes `/api/taches/[id]/documents` & `/api/taches/documents/[docId]`.

**⚠️ Pièges**
- `Combobox` Base UI : `isItemEqualToValue={(a,b)=>a?.value===b?.value}` (params nullables, sinon TS18047).
- Pièces jointes privées affichées via une route de **redirection** vers URL signée (évite de pré-signer à chaque poll/rendu).
- Vocaux : `audio/webm` (Chrome) / `audio/mp4` (Safari) ; bouton micro masqué si `MediaRecorder` indisponible.
- `Select` Base UI utilisé comme **menu d'action** (ajouter un co-assigné / une mention) : `value` figé sur sentinelle `__none__`, l'action est faite dans `onValueChange`.

### Infos à demander à l'utilisateur quand utile
- Nom de **branding** (remplace « ShipFree » dans `src/config/branding.ts` ; le cookie auth pointe encore `.shipfree.app` dans `auth.ts`).

---

## 11. Parc d'équipements (field-service / GMAO) — livré

Extension CRM validée : `Client → Localisation → Équipement installé → Entretiens`, étiquette **QR** par équipement, **documents/photos** par équipement. Concerne le parc **installé chez le client** (chaudière, poêle à bois, PAC, VMC…), **pas** l'outillage/stock. Modèle détaillé : `docs/cadrage-crm-chantiers-mvp.md` → « Extension v1.1 ».

**Schéma & migrations** — tables `client_location`, `equipment`, `equipment_maintenance`, `equipment_document` + enums `location_type`/`equipment_status`/`maintenance_type` + colonne `activity.equipmentId` (rappels). Migrations **0007** (parc) et **0008** (documents) **appliquées**. `equipment.clientId` est **dénormalisé** depuis la localisation (fixé côté service). Soft-delete partout sauf `equipment_document` (hard-delete + suppression objet bucket).

**Permissions** (`permissions.ts`) — `location` & `equipment` : admin/commercial complet · conducteur/terrain lecture. `maintenance` : admin/conducteur complet · terrain create/read/update · commercial lecture.

**Validation** `src/validation/` — `location.ts`, `equipment.ts`, `maintenance.ts`. Documents : réutilisent les constantes génériques de `validation/deal-document.ts`.

**Services** `src/services/crm/` — `location.ts` (softDelete cascade applicatif des équipements), `equipment.ts` (clientId dérivé de la localisation ; supporte le déplacement), `maintenance.ts` (recalcule `equipment.nextMaintenanceDate` via `nextDueDate` ou fréquence ; total des coûts), `equipment-document.ts` (upload/list/download/delete, perms `equipment`). Filtre `organizationId` partout.

**Façade** `src/app/(main)/equipements/actions.ts` — CRUD localisation/équipement/entretien + `createMaintenanceReminderTaskAction` (tâche de rappel liée client+équipement) + `deleteEquipmentDocumentAction`. Route Handlers `POST /api/equipements/[id]/documents` + `GET /api/equipements/documents/[docId]` (mêmes patterns que les documents d'affaire).

**UI**
- **Fiche client** → section **« Localisations & équipements »** (`clients/[id]/_components/locations-section.tsx` + `location-form-dialog.tsx`) : localisations + leurs équipements (badge « en retard »), liens vers `/equipements/[id]`.
- **Page équipement** `/equipements/[id]` (cible QR, login requis) : infos, prochain entretien + badge retard + **« Créer une tâche de rappel »**, **historique d'entretien** (CRUD), **Documents & photos** (vignettes pour les images), actions Modifier / Étiquette QR / Supprimer. Composants dans `equipements/[id]/_components/` + dialogues partagés dans `equipements/_components/` (`equipment-form-dialog`, `maintenance-form-dialog`).
- **Étiquette** `/equipements/[id]/etiquette` : QR (SVG généré côté serveur via lib **`qrcode`**) + nom/client/localisation/n° série, bouton Imprimer (CSS print isolant `#print-label`). URL du QR construite depuis les headers de la requête.
- Libellés `LOCATION_TYPE_LABELS`/`EQUIPMENT_STATUS_LABELS`/`MAINTENANCE_TYPE_LABELS` + `EQUIPMENT_CATEGORY_SUGGESTIONS` + `formatCost` dans `src/lib/crm/labels.ts`.
- `proxy.ts` : `/equipements/:path*` ajouté au matcher (garde de session).

**⚠️ Pièges**
- Le QR encode `/equipements/[id]` (page **interne**) → en dev l'URL pointe sur `localhost:3001` (non scannable depuis un mobile) ; OK en prod.
- `equipment.clientId` doit rester cohérent avec la localisation : toujours le dériver via `assertLocationInOrg` (fait dans le service).
- Dépendances ajoutées : `qrcode` + `@types/qrcode`.

### Suggestions non faites (proposées, en attente)
Impression d'étiquettes **par lot** (toutes les machines d'une localisation), **vue publique QR** par token (sans login), lien **entretien ↔ chantier**.

---

## 12. Rapports de chantier — livré

Entités **déjà en base** (cadrage §6/§7), **aucune migration** : `site_report` (unicité `(siteId, reportDate) WHERE deleted_at is null`, soft-delete) + `site_report_photo` (cascade). Enum `weather`.
- **Validation** `src/validation/site-report.ts` (date `YYYY-MM-DD`, météo, température, effectif, avancement, aléas) + libellés `WEATHER_LABELS`/`WEATHER_VALUES` dans `labels.ts`.
- **Services** `services/crm/site-report.ts` (list avec photos groupées + auteur ; create/update/softDelete ; **unicité jour/chantier** via `assertNoDuplicate` → `ForbiddenError` clair) et `site-report-photo.ts` (images uniquement via `classifyAttachment`, chemin `org/sites/<siteId>/reports/<reportId>/…`, hard-delete + suppression objet bucket). Perms `report` : admin/conducteur complet · terrain create/read/update · commercial lecture.
- **Façade** `chantiers/actions.ts` : `create/update/deleteSiteReportAction` + `deleteSiteReportPhotoAction`. Routes `POST /api/chantiers/reports/[reportId]/photos` + `GET /api/chantiers/reports/photos/[photoId]` (redirection URL signée).
- **UI** `chantiers/[id]/_components/site-reports-section.tsx` : historique des rapports (date, météo, effectif, avancement, aléas, vignettes photos), dialog **« Rapport du jour »** (date pré-remplie aujourd'hui, mobile-first), upload photos par rapport, édition/suppression. Stat **« Rapports »** branchée dans `site-stats.tsx` (le placeholder « Avancement » a été remplacé ; reste « Heures pointées — Bientôt »).

### Lien tâche ↔ équipement (livré, même session)
`activity.equipmentId` existait (parc d'équipements) mais n'était pas exposé. Désormais : `task.ts` joint l'équipement (`equipmentId`/`equipmentName` dans `TaskItem`) + `listTasksForEquipment` ; `listEquipmentOptions` (equipment.ts) ; sélecteur **Équipement** (Combobox) dans `task-form-dialog` (vue globale) ; lien équipement affiché sur `task-row` + fiche `/taches/[id]` ; **section Tâches** sur la fiche équipement (`TasksSection` `locked.equipmentId`). `locked` (tasks-section/form) accepte désormais `equipmentId`.

---

## 13. Prochaine étape — Pointage des heures

Feature suivante (CLAUDE.md §10 : … Rapports → **Pointage** → Dashboards). Entité **déjà en base** (cadrage §8) : `time_entry` (`siteId` onDelete **restrict**, `memberId`, `workDate`, `type` enum `time_entry_type` `travail|absence`, `hours` decimal(5,2), `note`, `approvedAt`/`approvedById`). **Hard-delete.** Index `(siteId, workDate)` + `(memberId, workDate)`. **Pas de migration attendue.**

**À faire (cycle imposé)** :
- **Validation** `src/validation/time-entry.ts` (workDate, memberId, type, hours > 0, note).
- **Service** `services/crm/time-entry.ts` : filtre `organizationId` + `requirePermission(ctx,'timeEntry',…)` ; saisie par salarié et par jour ; validation/approbation (`approvedAt`/`approvedById`) ; agrégats (heures par chantier / par salarié) pour brancher la stat **« Heures pointées »** de `site-stats.tsx`.
- **Façade** actions ; **UI mobile-first terrain** sur la fiche chantier (pointer ses heures du jour) + récap conducteur.

**Permissions `timeEntry`** (déjà dans `permissions.ts`) : admin/conducteur complet · terrain create/read/update (ses pointages) · commercial lecture. Le ciblage terrain « chantiers assignés » peut s'appuyer sur `site_member`.
