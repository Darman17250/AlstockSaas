# Cadrage — Modèle de données CRM & Suivi de chantiers (MVP)

> **Statut : VALIDÉ v1.** Source de vérité du modèle de données (cf. `CLAUDE.md`). Toute évolution passe par ce document puis une migration Drizzle versionnée.

## Principes (rappel)

- Chaîne métier : `Client/Contact → Affaire (pipeline) → [gagnée] → Chantier → Rapports + Pointage`.
- **Affaire ≠ Chantier** : entités distinctes reliées. Une affaire gagnée se convertit en chantier (pré-remplissage). Une affaire perdue ne crée rien. Un client peut avoir plusieurs chantiers.
- **Le client peut être une société OU un particulier** : entité unique `client` avec un discriminant `type`.
- Le statut « prospect » n'est **pas** un attribut du client : il découle du pipeline (un client sans affaire gagnée = prospect). La fiche client ne porte que la relation `client | prestataire`.
- **Hors périmètre** (absent du modèle) : facturation, devis, chiffrage/étude de prix, situations de travaux, recouvrement, factures fournisseurs comptables, paie. *(Le **matériel unitaire** — extension v1.3 — et le **stock consommable** avec achats/réceptions — extension v1.4 — sont désormais DANS le périmètre ; voir extensions ci-dessous. L'« achat » de v1.4 est un **bon de réception qui alimente le stock**, pas une facture fournisseur comptable.)*

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

## Extension v1.2 — Dépôts & véhicules

> Ajout validé après le parc d'équipements. Un **dépôt** = emplacement appartenant à l'**organisation** (entrepôt, atelier, véhicule…), à distinguer des `client_location` (qui appartiennent au client). Un **véhicule est un dépôt mobile** : même table avec un `type` + des champs véhicule **nullables** (pattern société/particulier de `client`). **Hors périmètre : aucun stock/contenu** dans les dépôts (juste les emplacements ; le stock viendra plus tard).

### `depot` — Dépôt (ou véhicule)
| Champ | Type | Notes |
|---|---|---|
| type | enum `depot_type` | `entrepot · atelier · vehicule · autre` |
| name | text, not null | |
| addressLine1/2, postalCode, city, country | text | Adresse |
| responsibleId | fk → member, null (set null) | Responsable du dépôt |
| notes | text | |
| **[véhicule]** registrationNumber | text, null | Immatriculation |
| **[véhicule]** brand, model | text, null | |
| **[véhicule]** year | int, null | Année |
| **[véhicule]** fuelType | enum `vehicle_fuel_type`, null | `essence · diesel · gpl · electrique · hybride · autre` |
| **[véhicule]** vin | text, null | N° de série |
| **[véhicule]** firstRegistrationDate | date, null | 1re mise en circulation |
| **[véhicule]** mileage | int, null | Kilométrage courant (remonté par les entretiens) |
| nextMaintenanceDate | date, null | Prochaine échéance (recalculée à chaque entretien) |

Soft-delete. Index : `organizationId`, `type`. Les champs véhicule ne sont conservés que si `type = vehicule` (nettoyés côté service sinon).

### `depot_maintenance` — Entretien d'un dépôt/véhicule (historique)
| Champ | Type | Notes |
|---|---|---|
| depotId | fk → depot, not null (cascade) | |
| type | enum `depot_maintenance_type` | `revision · vidange · pneus · controle_technique · reparation · carrosserie · autre` |
| performedAt | date, not null | |
| performedById | fk → member, null (set null) | |
| provider | text, null | Prestataire (garage, concessionnaire…) |
| mileage | int, null | Kilométrage au moment de l'entretien |
| cost | decimal(10,2), null | |
| description | text | |
| nextDueDate | date, null | Prochaine échéance (date) → alimente `depot.nextMaintenanceDate` |
| nextDueMileage | int, null | Prochaine échéance (km) |

Soft-delete. Index : `organizationId`, `depotId`. À chaque écriture : recalcule `depot.nextMaintenanceDate` (min des `nextDueDate` non supprimés) et remonte `depot.mileage` si l'entretien fournit un km supérieur.

### `depot_document` — Document d'un dépôt/véhicule
| Champ | Type | Notes |
|---|---|---|
| depotId | fk → depot, not null (cascade) | |
| category | enum `depot_document_category`, null | `carte_grise · assurance · controle_technique · facture · autre` |
| storagePath | text, not null | Supabase Storage (bucket privé `affaire-documents`, préfixe `…/depots/…`) |
| fileName, mimeType, size | text/int | Métadonnées |
| expiresAt | date, null | Échéance (assurance, contrôle technique…) |
| uploadedById | fk → member, null (set null) | |

Hard-delete (ligne + objet bucket). Index : `organizationId`, `depotId`. Perms : suivent la ressource `depot` (lecture `depot:read`, ajout/suppression `depot:update`).

### Liens & décisions
- `activity.depotId` (fk null, set null) ajouté → une **tâche** peut être un rappel d'entretien rattaché à un dépôt (réutilise Activités & tâches).
- Enums : `depot_type`, `depot_maintenance_type`, `vehicle_fuel_type`, `depot_document_category`.
- Permissions : `depot` (admin/conducteur complet · commercial/terrain lecture) ; `depotMaintenance` (admin/conducteur complet · terrain create/read/update · commercial lecture).
- Entretien au **kilométrage** en plus des dates ; échéances **documents** via `expiresAt` + `category`. Aucune table « stock ».

---

## Extension v1.3 — Parc de matériel (outillage & machines), transferts, QR & scanner

> Ajout validé après les dépôts & véhicules. Un **matériel** = actif **unitaire** appartenant à l'**organisation** (perceuse, perfo, meuleuse… ou nacelle, pelleteuse, mini-pelle…), suivi individuellement (1 ligne = 1 machine, n° de série). À distinguer de `equipment` (parc installé **chez le client**) et de `depot` (emplacements). **Table unique `tool`** avec `kind = outil | machine` (pattern dépôt/véhicule). **Hors périmètre : le stock par quantités / consommables** — ici on suit un actif unitaire, pas des références en quantité. (La note « hors périmètre » de CLAUDE.md §1 a été mise à jour en conséquence : matériel unitaire DEDANS, stock par quantités DEHORS.)

### `tool` (matériel) — soft-delete
- `id`, `organizationId` (fk, not null, idx), `kind` (`tool_kind`, idx), `name`, `category` (texte libre + datalist de suggestions outils/machines).
- Identification : `brand`, `model`, `serialNumber`, `reference`.
- `status` (`tool_status` : `disponible | en_service | en_panne | en_reparation | hors_service | perdu`, défaut `disponible`, idx).
- **Localisation courante exclusive** : `currentDepotId` (→ `depot`, set null, idx) **OU** `currentSiteId` (→ `site`, set null, idx) — au plus un non-null, **garanti côté service**. À la création, un **dépôt initial est requis**. La localisation ne change ensuite **que** par un transfert.
- `responsibleId` (→ `member`, set null), `purchaseDate`, `purchaseCost`, `maintenanceFrequencyMonths`, `nextMaintenanceDate` (recalculé depuis les entretiens).
- Champs **machine** (nullables) : `fuelLevel` (`fuel_level`), `engineHours` (compteur horaire).
- `notes`, timestamps, `deletedAt`.

### `tool_maintenance` (entretien) — soft-delete
Miroir de `depot_maintenance`, mais au **compteur horaire** (`hours` / `nextDueHours`) au lieu du kilométrage. `type` (`tool_maintenance_type`), `performedAt`, `performedById`, `provider`, `cost`, `description`, `nextDueDate`. À chaque écriture : recalcule `tool.nextMaintenanceDate` et remonte `engineHours` si l'entretien renseigne un compteur supérieur.

### `tool_transfer` (journal des transferts) — hard-delete, append-only
`toolId`, `fromDepotId`/`fromSiteId`/`toDepotId`/`toSiteId` (→ depot/site, set null), `transferredAt`, `transferredById`, `note`. Le service `createTransfer` est **transactionnel** : valide la destination dans l'org, fixe `from*` = localisation actuelle, met à jour `tool.current*` (exclusif), et applique le **statut automatique** : → chantier ⇒ `en_service` ; → dépôt ⇒ `disponible`, **sauf** si le statut est protégé (`en_panne`, `en_reparation`, `hors_service`, `perdu`).

### `tool_issue` (signalement de problème) — cycle par statut (pas de soft-delete)
`toolId`, `severity` (`tool_issue_severity` : `mineur | majeur | bloquant`), `status` (`tool_issue_status` : `ouvert | en_cours | resolu`, idx), `description`, `reportedById`, `resolvedById`, `resolvedAt`. Un problème **bloquant** met le matériel `en_panne` ; résoudre le **dernier** problème ouvert d'un matériel `en_panne` le repasse `disponible`.

### `tool_document` (documents) — hard-delete
Miroir de `depot_document` **sans `expiresAt`** : `category` (`tool_document_category` : `facture | manuel | garantie | photo | autre`), `storagePath`, `fileName`, `mimeType`, `size`, `uploadedById`. Chemin storage `org/tools/<id>/…`. Perms : suivent la ressource `tool`.

### Liens & décisions
- `activity.toolId` (fk null, set null) ajouté → une **tâche** peut être un rappel d'entretien rattaché à un matériel (réutilise Activités & tâches).
- Enums : `tool_kind`, `tool_status`, `tool_maintenance_type`, `tool_document_category`, `fuel_level`, `tool_issue_severity`, `tool_issue_status`.
- Permissions : `tool` (admin/conducteur complet · commercial/terrain lecture) ; `toolMaintenance` (admin/conducteur complet · terrain create/read/update · commercial lecture) ; `toolTransfer` (admin/conducteur create/read/delete · terrain create/read · commercial lecture) ; `toolIssue` (admin/conducteur complet · terrain create/read · commercial lecture).

### Convention QR & scanner global (transverse, réutilisable)
- **Tout QR encode l'URL absolue même-origine** de la page deep-link de l'entité, construite depuis les en-têtes de la requête. Aujourd'hui : équipement client → `/equipements/[id]` ; matériel → `/materiel/[id]/transfert` (scan ⇒ déplacer dans les deux sens). Demain (produits, chantiers…), il suffit d'imprimer un QR avec l'URL de leur page — **aucune modification du scanner**.
- **Scanner global** : composant caméra réutilisable (`@zxing/browser`) + dialog mobile-first, déclenché depuis une entrée « Scanner » de la sidebar (tous rôles authentifiés). Sur lecture d'une URL **même origine**, navigue vers son chemin interne ; sinon affiche le texte décodé. Repli **saisie manuelle** si caméra refusée/absente. La caméra exige **https** (ou `localhost`).

---

## Extension v1.4 — Stock (produits consommables), achats & coût moyen pondéré

> Ajout validé après le parc de matériel. Le **stock par quantités** entre désormais dans le périmètre. Un **produit** est une **référence fongible** (vis, ciment, câble, gaine…) suivie en **quantité**, répartie simultanément sur plusieurs **dépôts** et **chantiers** — à distinguer de `tool` (actif unitaire, 1 ligne = 1 machine) et de `equipment` (parc chez le client). La quantité d'un produit n'est **jamais stockée sur la fiche produit** : elle dérive des `stock_level` (source de vérité unique). Le **coût moyen pondéré (WAC)** est stocké sur le produit et recalculé à chaque **entrée**.

**Sémantique « stock global » (décidée avec l'utilisateur).** Le **stock global** d'un produit = la somme des quantités **en dépôts uniquement**. Déplacer une quantité vers un chantier la **sort du stock global** (déployée/consommée) ; un **retour chantier** la réintègre. La fiche produit affiche aussi « **sur chantiers actifs** » = quantité présente sur des chantiers non `termine`/`annule`.

### `product_category` / `product_subcategory` — Arborescence catalogue (soft-delete)
- `product_category` : `id`, `organizationId`, `name`. Idx `organizationId`.
- `product_subcategory` : `id`, `organizationId`, `categoryId` (→ category, **cascade**), `name`. Idx `organizationId`, `categoryId`.
- Une catégorie possède **plusieurs sous-catégories** ; un produit référence **une catégorie ET une sous-catégorie cohérentes** (la sous-catégorie doit appartenir à la catégorie — vérifié en service). Espace dédié de gestion `/stock/categories`. Soft-delete refusé si des produits y sont rattachés ; supprimer une catégorie soft-supprime ses sous-catégories.

### `product` — Produit (fiche catalogue) — soft-delete
| Champ | Type | Notes |
|---|---|---|
| title | text, not null | |
| imagePath | text, null | Image (Supabase Storage, préfixe `org/products/<id>/…`, URL signée à la lecture) |
| categoryId | fk → product_category, **not null** (restrict) | |
| subcategoryId | fk → product_subcategory, **not null** (restrict) | Cohérente avec la catégorie |
| unit | enum `product_unit`, not null | Unité (liste fixe) |
| description | text, null | |
| weightedAvgPrice | decimal(12,4), default 0, not null | **WAC stocké** (path-dependent, non recalculable depuis l'état courant) |
| initialPurchasePrice | decimal(12,4), null | Prix d'achat initial (mémo, amorce le WAC) |
| alertThreshold | decimal(14,3), null | **Seuil d'alerte** : badge « Stock bas » quand le stock global (dépôts) ≤ seuil. `null` = pas d'alerte |

Idx `organizationId`, `categoryId`, `subcategoryId`. **Quantité non stockée** (dérivée des `stock_level`).

### `stock_level` — Niveau de stock par localisation (balance, pas de soft-delete)
`productId` (cascade), **`depotId` (→ depot, cascade) XOR `siteId` (→ site, cascade)** — exactement un non-null (même logique exclusive que `tool`), `quantity` decimal(14,3) défaut 0 (**jamais négatif**). **Unicité partielle** `(productId, depotId)` et `(productId, siteId)` (un seul niveau par couple produit/localisation). Idx `organizationId`, `productId`, `depotId`, `siteId`.

### `stock_movement` — Journal des mouvements (hard-delete, append-only)
`productId` (cascade), `type` (`stock_movement_type` : `reception | transfer | return | adjustment`), `fromDepotId`/`fromSiteId`/`toDepotId`/`toSiteId` (→ depot/site, set null), `quantity` decimal(14,3), `unitPrice` decimal(12,4) null (WAC ou prix d'achat au moment, pour valoriser), `purchaseId` (→ purchase, set null, pour les réceptions), `note`, `movedById` (→ member, set null), `createdAt`. Idx `organizationId`, `productId`, `createdAt`.

### `supplier` — Fournisseur (soft-delete)
`name` (not null), `email`, `phone`, `addressLine1/2`, `postalCode`, `city`, `country` (défaut `FR`), `notes`. Idx `organizationId`. Espace dédié `/achats/fournisseurs`.

### `purchase` / `purchase_line` — Achat (bon de réception) — soft-delete sur l'en-tête
- `purchase` : `supplierId` (→ supplier, set null), `reference`, `status` (`purchase_status` : `brouillon | validee | annulee`, défaut `brouillon` = « en cours »), `orderDate`, `validatedAt`, `notes`. Idx `organizationId`, `status`, `supplierId`.
- `purchase_line` : `purchaseId` (cascade), `productId` (→ product, restrict), `quantity` decimal(14,3), `unitPrice` decimal(12,4) (prix d'achat de la ligne), `destinationDepotId`/`destinationSiteId` (→ depot/site, set null, **renseignés à la validation**, XOR). Idx `organizationId`, `purchaseId`, `productId`.

### Règles métier clés
- **Coût moyen pondéré (WAC)** — recalculé à chaque **entrée** (réception d'achat OU stock initial), au niveau produit, sur la quantité **totale détenue** (dépôts + chantiers) : `newWAC = (qtyAvant·WACavant + qtyReçue·prixAchat) / (qtyAvant + qtyReçue)`. **Les transferts/retours ne modifient pas le WAC** (la quantité reste détenue, elle change de localisation).
- **Stock initial à la création** : la quantité de départ est **répartissable sur plusieurs dépôts** (lignes dépôt + quantité), au prix d'achat unitaire commun qui amorce le WAC.
- **Transferts** (3 sens, **jamais chantier → chantier** — repasser par un dépôt) : `dépôt→dépôt`, `dépôt→chantier`, `chantier→dépôt` (retour). Service **transactionnel** avec **verrou ligne** (`SELECT … FOR UPDATE`) sur la source et **contrôle de disponibilité** (`InsufficientStockError` si quantité insuffisante). Décrément source + (upsert) incrément destination + mouvement (`transfer` / `return`).
- **Réception d'achat** : un achat `brouillon` n'impacte pas le stock ; sa **validation** ventile chaque ligne vers sa destination (dépôt OU chantier), incrémente le `stock_level`, recalcule le WAC, journalise (`reception`), passe l'achat `validee` (`validatedAt`). **Idempotent** (un achat déjà validé/annulé ne peut pas l'être à nouveau).
- **Valeurs affichées** : valeur d'une localisation = `Σ quantité × WAC` ; sections « Stock » (valeur + produits présents) sur les **fiches dépôt & chantier**.
- **Suppression produit** refusée s'il reste du stock détenu.

### Étiquettes & impression groupée
- Page **interne** d'étiquette produit `/stock/[id]/etiquette` : **image + titre + QR**, le QR encodant l'URL absolue même-origine de la **fiche produit** `/stock/[id]` (convention QR transverse v1.3 — aucune modification du scanner).
- **Liste d'impression** : sélection de plusieurs produits (persistée côté client) puis **impression groupée** d'une planche multi-étiquettes (`/stock/etiquettes`), service `listProductsByIds` (filtré `organizationId`).

### Enums, permissions & liens
- Enums : `product_unit` (`u · ml · m2 · m3 · kg · t · l · sac · palette · rouleau · boite · lot · h`), `stock_movement_type` (`reception · transfer · return · adjustment`), `purchase_status` (`brouillon · validee · annulee`). Le type `adjustment` est prévu pour une future régularisation d'inventaire (UI non livrée).
- Permissions : `product` (admin/conducteur complet · commercial/terrain lecture) ; `productCategory` (admin/conducteur complet · commercial/terrain lecture) ; `supplier` & `purchase` (admin/conducteur complet · commercial/terrain lecture) ; `stockMovement` (admin/conducteur create/read/delete · terrain create/read · commercial lecture).
- Entrées sidebar : **Stock** (`/stock`, ressource `product`) et **Achats** (`/achats`, ressource `purchase`).

---

## Extension v1.5 — Équipe enrichie : rôles personnalisés & habilitations

Enrichit la gestion de l'équipe : rôles **personnalisés par organisation** (au-delà des rôles intégrés) et suivi des **habilitations/certifications BTP** par membre, avec documents et alertes d'expiration. Périmètre EXCLU inchangé (pas de coût/paie/facturation).

### `custom_role` — Rôle personnalisé (hard-delete, bloqué si utilisé)
- `id` (uuid pk), `organizationId` (fk non null, indexée), `name`, `slug` (unique par org — **stocké sur `member.role`**, coexiste avec les slugs intégrés), `description?`, `color?` (#RRGGBB), `permissions` (jsonb : `Record<BusinessResource, Action[]>`), `isSystem` (bool, false pour les rôles custom), `createdAt`, `updatedAt`.
- Index : `organizationId` ; unique `(organizationId, slug)`.

### `member_habilitation` — Habilitation/certification d'un membre (hard-delete)
- `id` (uuid pk), `organizationId` (fk non null, indexée), `memberId` (fk → `member`, `onDelete cascade`, indexée).
- `type` (enum `habilitation_type`), `name` (libellé précis, ex. « CACES R489 cat. 3 »), `issuer?` (organisme), `reference?` (n° de certificat), `issuedAt?` (date), `expiresAt?` (date — null = sans expiration).
- Document inline (un courant par habilitation ; le renouvellement remplace le fichier) : `storagePath?`, `fileName?`, `mimeType?`, `size?`, `uploadedById` (fk → `member`, `set null`).
- Index : `organizationId`, `memberId`, `expiresAt`.

### Statut & alertes (visuelles)
- Statut dérivé de `expiresAt` : `valide` | `expire_bientot` (≤ seuil) | `expiree` ; seuil partagé `HABILITATION_EXPIRY_WARN_DAYS = 30` jours.
- Alertes : pastille de statut sur la fiche membre, bannière en haut de l'écran Équipe, widget « Habilitations à renouveler » sur le dashboard. Le service `listExpiringHabilitations` reste réutilisable par un futur canal e-mail (V2).

### Enums, permissions & liens
- Enum : `habilitation_type` (`caces · travail_hauteur · habilitation_elec · amiante_ss4 · secourisme_sst · permis · nacelle · echafaudage · autre`).
- Nouvelle ressource access-control **`habilitation`** (crud) ajoutée à `statement` et aux rôles intégrés : owner/admin complet · conducteur read+update · terrain read · commercial read. L'écran Équipe (écriture) est réservé à owner/admin.
- **Résolution des permissions** : `BUILTIN_PERMISSIONS` (rôles intégrés) reste la source de vérité ; pour un rôle custom, la matrice `permissions` est chargée une fois dans `OrgContext.permissions` par `getOrgContext()`. `can(ctx, resource, action)` reste **synchrone** partout (aucun `await` ajouté aux services).
- **Décisions** : (1A) le slug du rôle est porté par `member.role` ; (3A) suppression d'un rôle **bloquée** tant que des membres l'utilisent ; assignation d'un rôle custom écrite directement sur `member.role` (le plugin Better-Auth ne valide que ses rôles statiques) ; invitations limitées aux rôles intégrés assignables.
- Documents : mêmes garde-fous MIME/taille que les autres documents (cf. v1.2), URLs signées, `storagePath = ${orgId}/members/${memberId}/habilitations/${uuid}-${nom}`.
- Entrée sidebar : **Équipe** (`/equipe`, réservée owner/admin) ; fiche membre `/equipe/[memberId]`.

---

## Décisions arrêtées (v1)

1. **Client = société OU particulier** : entité unique `client` (`type = societe | particulier`), table nommée `client`.
2. **`relationType` = `client | prestataire`** (type unique, pas de multi-relation). Le statut « prospect » est porté par le pipeline d'affaires, pas par la fiche.
3. **`deal.estimatedAmount`** conservé (montant estimé d'affaire, pas un devis).
4. **Pointage** en nombre d'heures (`hours` décimal), pas de plage horaire.
5. **`site_report`** : un seul rapport par (chantier, jour) → unicité `(siteId, reportDate)`.
6. **`deal.clientId` et `site.clientId` obligatoires** : impossible de créer une affaire/un chantier sans client enregistré.
7. **Aucun champ BTP supplémentaire** au MVP (pas de n° de lot, type de travaux, réf. marché).
