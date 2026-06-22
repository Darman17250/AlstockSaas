# Cadrage — Modèle de données CRM & Suivi de chantiers (MVP)

> **Statut : VALIDÉ v1.** Source de vérité du modèle de données (cf. `CLAUDE.md`). Toute évolution passe par ce document puis une migration Drizzle versionnée.

## Principes (rappel)

- Chaîne métier : `Client/Contact → Affaire (pipeline) → [gagnée] → Chantier → Rapports + Pointage`.
- **Affaire ≠ Chantier** : entités distinctes reliées. Une affaire gagnée se convertit en chantier (pré-remplissage). Une affaire perdue ne crée rien. Un client peut avoir plusieurs chantiers.
- **Le client peut être une société OU un particulier** : entité unique `client` avec un discriminant `type`.
- Le statut « prospect » n'est **pas** un attribut du client : il découle du pipeline (un client sans affaire gagnée = prospect). La fiche client ne porte que la relation `client | prestataire`.
- **Hors périmètre** (absent du modèle) : facturation, devis, chiffrage/étude de prix, situations de travaux, recouvrement, factures fournisseurs, paie, stock/matériel.

## Conventions appliquées à toutes les tables métier

- `id` : uuid, clé primaire.
- `organizationId` : fk vers `organization` (plugin), **non null, indexée** — cloisonnement multi-tenant.
- `createdAt`, `updatedAt` : timestamptz.
- **Soft-delete** (`deletedAt` timestamptz nullable) sur les entités à valeur métier : `client`, `contact`, `deal`, `site`, `site_report`. Filtré `deletedAt is null` par défaut.
- Hard-delete assumé pour les entités « journal » : `activity`, `time_entry`, `site_report_photo` (cette dernière en cascade du rapport).
- Enums = enums Postgres (via Drizzle), jamais de `text` libre.
- Colonnes `camelCase` côté Drizzle / `snake_case` en base.

## Tables fournies par Better-Auth (NE PAS redéfinir)

`user`, `session` (+ `activeOrganizationId`), `account`, `verification`, `organization`, `member`, `invitation`.
Les rôles métier (`admin`, `commercial`, `conducteur`, `terrain`) sont gérés par l'access-control du plugin (pas une table métier).

---

## Entités métier

### 1. `client` — Client / prestataire (société ou particulier)

| Champ | Type | Notes |
|---|---|---|
| type | enum `client_type`, not null | `societe` \| `particulier` |
| relationType | enum `relation_type`, not null | `client` \| `prestataire` |
| name | text, not null | Raison sociale (societe) **ou** nom complet (particulier) |
| civility | enum `civility`, null | `monsieur` \| `madame` — particulier |
| siret | text, null | Société uniquement |
| sector | text, null | Corps de métier / secteur |
| email | text, null | |
| phone | text, null | |
| website | text, null | |
| addressLine1 | text, null | |
| addressLine2 | text, null | |
| postalCode | text, null | |
| city | text, null | |
| country | text, default `FR` | |
| ownerId | fk → member, null | Commercial en charge |
| notes | text, null | |

Soft-delete. Index : `organizationId`, `type`, `relationType`.

### 2. `contact` — Interlocuteur

Personnes d'une société. Pour un client `particulier`, le client **est** son propre interlocuteur (contacts optionnels).

| Champ | Type | Notes |
|---|---|---|
| clientId | fk → client, null (onDelete set null) | Rattachement à un client |
| firstName | text, not null | |
| lastName | text, null | |
| jobTitle | text, null | Fonction |
| email | text, null | |
| phone | text, null | |
| mobile | text, null | |
| isPrimary | boolean, default false | Contact principal du client |
| notes | text, null | |

Soft-delete. Index : `organizationId`, `clientId`.

### 3. `deal` — Affaire (pipeline)

| Champ | Type | Notes |
|---|---|---|
| title | text, not null | Intitulé de l'affaire |
| clientId | fk → client, **not null** (onDelete restrict) | Client concerné — obligatoire (pas d'affaire sans client) |
| primaryContactId | fk → contact, null (onDelete set null) | Interlocuteur |
| status | enum `deal_status`, default `en_cours` | `en_cours` \| `gagnee` \| `perdue` |
| stage | enum `deal_stage`, default `nouveau` | Colonne kanban quand `en_cours` : `nouveau` \| `qualification` \| `proposition` \| `negociation` |
| estimatedAmount | decimal(12,2), null | Montant estimé de l'affaire (valeur pipeline, **pas** un devis) |
| currency | text, default `EUR` | |
| probability | int, null | % de réussite |
| expectedCloseDate | date, null | |
| source | enum `deal_source`, null | `site_web` \| `recommandation` \| `appel_entrant` \| `prospection` \| `salon` \| `autre` |
| ownerId | fk → member, null | Commercial |
| lostReason | text, null | Motif de perte |
| wonAt | timestamptz, null | |
| lostAt | timestamptz, null | |
| siteId | fk → site, null (onDelete set null) | Chantier créé à la conversion |
| notes | text, null | |

Soft-delete. Index : `organizationId`, `status`, `stage`, `clientId`.

### 4. `activity` — Activité & tâche

Modèle unifié : un log d'interaction OU une tâche (selon `type`/`dueDate`).

| Champ | Type | Notes |
|---|---|---|
| type | enum `activity_type` | `appel` \| `email` \| `reunion` \| `visite` \| `note` \| `tache` |
| subject | text, not null | |
| description | text, null | |
| dueDate | timestamptz, null | Échéance/rappel (tâches) |
| status | enum `task_status`, default `a_faire` | `a_faire` \| `fait` \| `annule` |
| completedAt | timestamptz, null | |
| assigneeId | fk → member, null | À qui |
| clientId | fk → client, null | Liens explicites (au moins un attendu) |
| contactId | fk → contact, null | |
| dealId | fk → deal, null | |
| siteId | fk → site, null | |

Hard-delete. Index : `organizationId`, `assigneeId`, `dueDate`, `status`.

**Extensions tâches** (sur les `activity` de type `tache`) :
- `task_assignee` — **co-assignés** d'une tâche (n–n `activity ↔ member`), en plus de `assigneeId` (le responsable). Champs : `taskId` (cascade), `memberId` (cascade). Hard-delete, unicité `(taskId, memberId)`, index `organizationId`/`taskId`/`memberId`. « Mes tâches » = responsable **ou** co-assigné.
- `task_document` — pièces jointes d'une tâche (images **et** documents). Champs : `taskId` (cascade), `storagePath`, `fileName`, `mimeType`, `size`, `uploadedById` (set null). Hard-delete, index `organizationId`/`taskId`. Lecture `activity:read`, ajout/suppression `activity:update`.

### 5. `site` — Chantier

| Champ | Type | Notes |
|---|---|---|
| name | text, not null | Nom du chantier |
| reference | text, null | Code chantier interne |
| clientId | fk → client, **not null** (onDelete restrict) | Client — obligatoire |
| dealId | fk → deal, null (onDelete set null) | Affaire d'origine |
| status | enum `site_status`, default `prepa` | `prepa` \| `en_cours` \| `en_pause` \| `termine` \| `annule` |
| addressLine1 | text, null | Lieu du chantier (peut différer du client) |
| postalCode | text, null | |
| city | text, null | |
| country | text, default `FR` | |
| startDate | date, null | Début planifié |
| endDate | date, null | Fin planifiée |
| actualStartDate | date, null | |
| actualEndDate | date, null | |
| conducteurId | fk → member, null | Conducteur de travaux (responsable unique) |
| description | text, null | |

Soft-delete. Index : `organizationId`, `status`, `clientId`.

### 5.bis `site_member` — Équipe assignée à un chantier (n–n)

Salariés (membres de l'org) affectés à un chantier, en plus du `conducteurId` unique. Table de liaison qui matérialise la notion « chantiers assignés » (cf. permissions `terrain`).

| Champ | Type | Notes |
|---|---|---|
| siteId | fk → site, not null (onDelete **cascade**) | Chantier |
| memberId | fk → member, not null (onDelete **cascade**) | Salarié assigné |

Hard-delete (lien). **Unicité `(siteId, memberId)`** (un salarié assigné une seule fois). Index : `organizationId`, `siteId`, `memberId`.

### 5.ter Discussion de chantier (chat)

Fil de discussion collaboratif par chantier (texte, mentions de salariés/tâches, images, messages vocaux). Lecture/écriture = `site:read` (pour que le terrain participe) ; suppression d'un message = auteur ou `site:update`.

**`site_message`** — message du fil.

| Champ | Type | Notes |
|---|---|---|
| siteId | fk → site, not null (onDelete **cascade**) | Chantier |
| authorId | fk → member, null (onDelete set null) | Auteur (conservé si l'auteur quitte l'org) |
| body | text, null | Texte (peut être vide si pièce jointe seule) |

Soft-delete. Index : `organizationId`, `siteId`, `createdAt`.

**`site_message_mention`** — tag dans un message (exactement un des deux renseigné).

| Champ | Type | Notes |
|---|---|---|
| messageId | fk → site_message, not null (**cascade**) | |
| memberId | fk → member, null (**cascade**) | Mention `@salarié` |
| taskId | fk → activity, null (**cascade**) | Mention `#tâche` |

Hard-delete (cascade du message). Index : `organizationId`, `messageId`, `memberId`, `taskId`.

**`site_message_attachment`** — pièce jointe (image ou vocal).

| Champ | Type | Notes |
|---|---|---|
| messageId | fk → site_message, not null (**cascade**) | |
| kind | enum `message_attachment_kind` | `image` \| `audio` |
| storagePath | text, not null | Supabase Storage (URL signée à la lecture) |
| fileName, mimeType, size | | |
| durationMs | int, null | Durée d'un vocal |

Hard-delete (cascade du message). Index : `organizationId`, `messageId`. Enum ajouté : `message_attachment_kind` (image, audio).

### 6. `site_report` — Rapport de chantier journalier

**Un seul rapport par (chantier, jour)** — contrainte d'unicité `(siteId, reportDate)`.

| Champ | Type | Notes |
|---|---|---|
| siteId | fk → site, not null (onDelete **restrict**) | Supprimer un chantier ne casse pas ses rapports (cf. CLAUDE.md §5) |
| reportDate | date, not null | Jour du rapport |
| authorId | fk → member, null | Saisie terrain |
| weather | enum `weather`, null | `ensoleille` \| `nuageux` \| `pluvieux` \| `neigeux` \| `venteux` |
| temperature | int, null | °C |
| workforceCount | int, null | Effectif présent |
| progressNotes | text, null | Travaux réalisés / avancement |
| issues | text, null | Aléas / problèmes |

Soft-delete. Index : `organizationId`, `siteId`, **unique `(siteId, reportDate)`**.

### 7. `site_report_photo` — Photo de rapport

| Champ | Type | Notes |
|---|---|---|
| reportId | fk → site_report, not null (onDelete **cascade**) | |
| storagePath | text, not null | Chemin Supabase Storage (URL signée à la lecture) |
| caption | text, null | |
| takenAt | timestamptz, null | |

Hard-delete (cascade du rapport). Index : `organizationId`, `reportId`.

### 8. `time_entry` — Pointage des heures

| Champ | Type | Notes |
|---|---|---|
| siteId | fk → site, not null (onDelete **restrict**) | |
| memberId | fk → member, not null | Personne pointée |
| workDate | date, not null | |
| type | enum `time_entry_type`, default `travail` | `travail` \| `absence` |
| hours | decimal(5,2), not null | Nb d'heures (ex. 7.50) |
| note | text, null | |
| approvedAt | timestamptz, null | Validation conducteur |
| approvedById | fk → member, null | |

Hard-delete. Index : `organizationId`, `(siteId, workDate)`, `(memberId, workDate)`.

---

## Enums Postgres

`client_type` (societe, particulier), `civility` (monsieur, madame), `relation_type` (client, prestataire), `deal_status` (en_cours, gagnee, perdue), `deal_stage` (nouveau, qualification, proposition, negociation), `deal_source` (site_web, recommandation, appel_entrant, prospection, salon, autre), `activity_type` (appel, email, reunion, visite, note, tache), `task_status` (a_faire, fait, annule), `site_status` (prepa, en_cours, en_pause, termine, annule), `weather` (ensoleille, nuageux, pluvieux, neigeux, venteux), `time_entry_type` (travail, absence).

## Relations (synthèse) & onDelete

- `client 1—n contact` (set null), `client 1—n deal` (**restrict**, clientId obligatoire), `client 1—n site` (**restrict**), `client 1—n activity` (set null).
- `deal 1—1? site` via `deal.siteId` / `site.dealId` (set null des deux côtés — conversion).
- `site 1—n site_report` (**restrict**), `site 1—n time_entry` (**restrict**).
- `site n—n member` via `site_member` (**cascade** des deux côtés) — équipe assignée, en plus de `site.conducteurId`.
- `site_report 1—n site_report_photo` (**cascade**).
- `member` référencé en `ownerId`/`assigneeId`/`conducteurId`/`authorId`/`memberId`/`approvedById`.

## Permissions par rôle (vérifiées en couche service)

| Rôle | CRM (client/contact/deal/activity) | Chantiers (site) | Rapports + Pointage |
|---|---|---|---|
| `admin` | complet | complet | complet |
| `commercial` | complet | lecture | lecture |
| `conducteur` | lecture | complet | complet |
| `terrain` | lecture limitée | lecture (chantiers assignés) | écriture sur chantiers assignés |

---

## Extension v1.1 — Parc d'équipements (field-service / GMAO)

> Ajout validé après le MVP initial. Chaîne : `Client → Localisation → Équipement installé → Entretiens`. Concerne le **parc installé à demeure chez le client** (chaudière, poêle à bois, PAC, climatisation, VMC, chauffe-eau…), **PAS** l'outillage de l'entreprise ni les consommables (le « stock/matériel » reste hors périmètre).

### `client_location` — Localisation d'un client
| Champ | Type | Notes |
|---|---|---|
| clientId | fk → client, not null (cascade) | Client propriétaire |
| type | enum `location_type` | `maison · appartement · local_commercial · immeuble · terrain · autre` |
| name | text, not null | Ex. « Maison principale » |
| addressLine1/2, postalCode, city, country | text | Adresse de la localisation |
| notes | text | |

Soft-delete (avec soft-delete en cascade applicatif de ses équipements). Index : `organizationId`, `clientId`.

### `equipment` — Équipement installé
| Champ | Type | Notes |
|---|---|---|
| locationId | fk → client_location, not null (cascade) | Localisation |
| clientId | fk → client, not null (cascade) | Dénormalisé depuis la localisation |
| name | text, not null | |
| category | text | Champ libre (Chaudière, Poêle à bois…) |
| brand, model, serialNumber | text | |
| installDate | date | |
| status | enum `equipment_status` | `en_service · en_panne · hors_service · a_remplacer` |
| maintenanceFrequencyMonths | int | Fréquence d'entretien |
| nextMaintenanceDate | date | Prochaine échéance (maj à chaque entretien) |
| notes | text | |

Soft-delete. Index : `organizationId`, `locationId`, `clientId`. La page interne `/equipements/[id]` est la cible du **QR** imprimable.

### `equipment_maintenance` — Entretien (historique)
| Champ | Type | Notes |
|---|---|---|
| equipmentId | fk → equipment, not null (cascade) | |
| type | enum `maintenance_type` | `entretien · reparation · installation · controle` |
| performedAt | date, not null | |
| performedById | fk → member, null (set null) | Qui a fait l'entretien (membre de l'équipe) |
| cost | decimal(10,2), null | Coût |
| description | text | |
| nextDueDate | date, null | Prochaine échéance proposée |

Soft-delete. Index : `organizationId`, `equipmentId`.

### `equipment_document` — Document/photo d'un équipement
| Champ | Type | Notes |
|---|---|---|
| equipmentId | fk → equipment, not null (cascade) | |
| storagePath | text, not null | Supabase Storage (bucket privé `affaire-documents`, préfixe `…/equipment/…`) |
| fileName, mimeType, size | text/int | Métadonnées |
| uploadedById | fk → member, null (set null) | |

Hard-delete (ligne + objet bucket supprimés ensemble). Index : `organizationId`, `equipmentId`. Images/PDF/Office (≤ 20 Mo). Perms : lecture `equipment:read`, ajout/suppression `equipment:update`.

### Liens & décisions
- `activity.equipmentId` (fk null, set null) ajouté → une **tâche** peut être un rappel d'entretien rattaché à un équipement (réutilise Activités & tâches).
- Enums : `location_type`, `equipment_status`, `maintenance_type`.
- Permissions : `location` & `equipment` (admin/commercial complet · conducteur/terrain lecture) ; `maintenance` (admin/conducteur complet · terrain create/read/update · commercial lecture).
- QR = page **interne** (login requis) ; URL construite depuis les headers de la requête. Aucune table « stock ».

---

## Décisions arrêtées (v1)

1. **Client = société OU particulier** : entité unique `client` (`type = societe | particulier`), table nommée `client`.
2. **`relationType` = `client | prestataire`** (type unique, pas de multi-relation). Le statut « prospect » est porté par le pipeline d'affaires, pas par la fiche.
3. **`deal.estimatedAmount`** conservé (montant estimé d'affaire, pas un devis).
4. **Pointage** en nombre d'heures (`hours` décimal), pas de plage horaire.
5. **`site_report`** : un seul rapport par (chantier, jour) → unicité `(siteId, reportDate)`.
6. **`deal.clientId` et `site.clientId` obligatoires** : impossible de créer une affaire/un chantier sans client enregistré.
7. **Aucun champ BTP supplémentaire** au MVP (pas de n° de lot, type de travaux, réf. marché).
