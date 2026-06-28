import { relations, sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  date,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  jsonb,
  decimal,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Fourni par le plugin Better-Auth `organization` : org active de la session.
    activeOrganizationId: text('active_organization_id'),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

// Payment system tables
export const customer = pgTable(
  'customer',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'stripe', 'polar', 'dodo', 'creem', 'autumn'
    providerCustomerId: text('provider_customer_id').notNull(), // Customer ID from payment provider
    email: text('email'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('customer_userId_idx').on(table.userId),
    index('customer_provider_customerId_idx').on(table.providerCustomerId),
  ]
)

export const subscription = pgTable(
  'subscription',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(), // 'stripe', 'polar', 'dodo', 'creem', 'autumn'
    providerSubscriptionId: text('provider_subscription_id').notNull(), // Subscription ID from payment provider
    status: text('status').notNull(), // 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
    plan: text('plan').notNull(), // 'free', 'starter', 'pro', 'enterprise', etc.
    interval: text('interval'), // 'month', 'year', null for one-time
    amount: decimal('amount', { precision: 10, scale: 2 }), // Price amount
    currency: text('currency'), // 'usd', 'eur', etc.
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    canceledAt: timestamp('canceled_at'),
    trialStart: timestamp('trial_start'),
    trialEnd: timestamp('trial_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('subscription_userId_idx').on(table.userId),
    index('subscription_customerId_idx').on(table.customerId),
    index('subscription_provider_subscriptionId_idx').on(table.providerSubscriptionId),
    index('subscription_status_idx').on(table.status),
  ]
)

export const payment = pgTable(
  'payment',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    subscriptionId: text('subscription_id').references(() => subscription.id, {
      onDelete: 'set null',
    }),
    provider: text('provider').notNull(), // 'stripe', 'polar', 'dodo', 'creem', 'autumn'
    providerPaymentId: text('provider_payment_id').notNull(), // Payment ID from provider
    type: text('type').notNull(), // 'subscription', 'one_time', 'refund'
    status: text('status').notNull(), // 'succeeded', 'pending', 'failed', 'canceled'
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('payment_userId_idx').on(table.userId),
    index('payment_customerId_idx').on(table.customerId),
    index('payment_subscriptionId_idx').on(table.subscriptionId),
    index('payment_provider_paymentId_idx').on(table.providerPaymentId),
  ]
)

export const premiumPurchase = pgTable(
  'premium_purchase',
  {
    id: text('id').primaryKey(),
    stripeSessionId: text('stripe_session_id').notNull().unique(),
    stripeCustomerEmail: text('stripe_customer_email'),
    githubEmail: text('github_email'),
    githubUsername: text('github_username'),
    twitterHandle: text('twitter_handle'),
    amountPaid: decimal('amount_paid', { precision: 10, scale: 2 }),
    currency: text('currency'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('premium_purchase_stripe_sessionId_idx').on(table.stripeSessionId)]
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

// Payment system relations
export const customerRelations = relations(customer, ({ one, many }) => ({
  user: one(user, {
    fields: [customer.userId],
    references: [user.id],
  }),
  subscriptions: many(subscription),
  payments: many(payment),
}))

export const subscriptionRelations = relations(subscription, ({ one, many }) => ({
  user: one(user, {
    fields: [subscription.userId],
    references: [user.id],
  }),
  customer: one(customer, {
    fields: [subscription.customerId],
    references: [customer.id],
  }),
  payments: many(payment),
}))

export const paymentRelations = relations(payment, ({ one }) => ({
  user: one(user, {
    fields: [payment.userId],
    references: [user.id],
  }),
  customer: one(customer, {
    fields: [payment.customerId],
    references: [customer.id],
  }),
  subscription: one(subscription, {
    fields: [payment.subscriptionId],
    references: [subscription.id],
  }),
}))

// ============================================================================
// Plugin Better-Auth `organization` (multi-tenant)
// Tables attendues par le plugin — déclarées ici uniquement pour que Drizzle
// gère leurs migrations. Ne JAMAIS écrire dedans directement : passer par les
// API du plugin (inviteMember, addMember, updateMemberRole, removeMember…).
// ============================================================================

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const member = pgTable(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').default('member').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('member_organizationId_idx').on(table.organizationId),
    index('member_userId_idx').on(table.userId),
  ]
)

export const invitation = pgTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('invitation_organizationId_idx').on(table.organizationId)]
)

// ============================================================================
// Enums métier (cf. docs/cadrage-crm-chantiers-mvp.md)
// ============================================================================

export const clientTypeEnum = pgEnum('client_type', ['societe', 'particulier'])
export const civilityEnum = pgEnum('civility', ['monsieur', 'madame'])
export const relationTypeEnum = pgEnum('relation_type', ['client', 'prestataire'])
export const dealStatusEnum = pgEnum('deal_status', ['en_cours', 'gagnee', 'perdue'])
export const dealStageEnum = pgEnum('deal_stage', [
  'nouveau',
  'qualification',
  'proposition',
  'negociation',
])
export const dealSourceEnum = pgEnum('deal_source', [
  'site_web',
  'recommandation',
  'appel_entrant',
  'prospection',
  'salon',
  'autre',
])
export const activityTypeEnum = pgEnum('activity_type', [
  'appel',
  'email',
  'reunion',
  'visite',
  'note',
  'tache',
])
export const taskStatusEnum = pgEnum('task_status', ['a_faire', 'fait', 'annule'])
export const siteStatusEnum = pgEnum('site_status', [
  'prepa',
  'en_cours',
  'en_pause',
  'termine',
  'annule',
])
export const weatherEnum = pgEnum('weather', [
  'ensoleille',
  'nuageux',
  'pluvieux',
  'neigeux',
  'venteux',
])
export const timeEntryTypeEnum = pgEnum('time_entry_type', ['travail', 'absence'])

// Parc d'équipements installés chez le client (field-service / GMAO).
export const locationTypeEnum = pgEnum('location_type', [
  'maison',
  'appartement',
  'local_commercial',
  'immeuble',
  'terrain',
  'autre',
])
export const equipmentStatusEnum = pgEnum('equipment_status', [
  'en_service',
  'en_panne',
  'hors_service',
  'a_remplacer',
])
export const maintenanceTypeEnum = pgEnum('maintenance_type', [
  'entretien',
  'reparation',
  'installation',
  'controle',
])

// Dépôts & véhicules : emplacements appartenant à l'organisation (entrepôt,
// atelier, véhicule…), distincts des `client_location` (qui sont chez le client).
export const depotTypeEnum = pgEnum('depot_type', ['entrepot', 'atelier', 'vehicule', 'autre'])
export const depotMaintenanceTypeEnum = pgEnum('depot_maintenance_type', [
  'revision',
  'vidange',
  'pneus',
  'controle_technique',
  'reparation',
  'carrosserie',
  'autre',
])
export const vehicleFuelTypeEnum = pgEnum('vehicle_fuel_type', [
  'essence',
  'diesel',
  'gpl',
  'electrique',
  'hybride',
  'autre',
])
export const depotDocumentCategoryEnum = pgEnum('depot_document_category', [
  'carte_grise',
  'assurance',
  'controle_technique',
  'facture',
  'autre',
])

// Matériel : parc d'actifs unitaires de l'organisation (outillage + machines),
// distinct de `equipment` (chez le client) et `depot` (emplacements). La
// localisation courante est SOIT un dépôt SOIT un chantier (transfert).
export const toolKindEnum = pgEnum('tool_kind', ['outil', 'machine'])
export const toolStatusEnum = pgEnum('tool_status', [
  'disponible',
  'en_service',
  'en_panne',
  'en_reparation',
  'hors_service',
  'perdu',
])
export const toolMaintenanceTypeEnum = pgEnum('tool_maintenance_type', [
  'controle',
  'reparation',
  'revision',
  'etalonnage',
  'remplacement_piece',
  'autre',
])
export const toolDocumentCategoryEnum = pgEnum('tool_document_category', [
  'facture',
  'manuel',
  'garantie',
  'photo',
  'autre',
])
export const fuelLevelEnum = pgEnum('fuel_level', [
  'vide',
  'quart',
  'moitie',
  'trois_quarts',
  'plein',
])
export const toolIssueSeverityEnum = pgEnum('tool_issue_severity', ['mineur', 'majeur', 'bloquant'])
export const toolIssueStatusEnum = pgEnum('tool_issue_status', ['ouvert', 'en_cours', 'resolu'])

// Stock : produits consommables fongibles (quantités) répartis sur plusieurs
// dépôts et chantiers. Distinct de `tool` (actifs unitaires). Unité fixe (enum),
// coût moyen pondéré stocké sur le produit, mouvements append-only.
export const productUnitEnum = pgEnum('product_unit', [
  'u',
  'ml',
  'm2',
  'm3',
  'kg',
  't',
  'l',
  'sac',
  'palette',
  'rouleau',
  'boite',
  'lot',
  'h',
])
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'reception',
  'transfer',
  'return',
  'adjustment',
])
export const purchaseStatusEnum = pgEnum('purchase_status', ['brouillon', 'validee', 'annulee'])

// Habilitations / certifications BTP d'un membre (cf. cadrage v1.5).
export const habilitationTypeEnum = pgEnum('habilitation_type', [
  'caces',
  'travail_hauteur',
  'habilitation_elec',
  'amiante_ss4',
  'secourisme_sst',
  'permis',
  'nacelle',
  'echafaudage',
  'autre',
])

// ============================================================================
// Tables métier — toutes portent organizationId (non null, indexé) pour le
// cloisonnement multi-tenant. Soft-delete (deletedAt) sur les entités à valeur.
// ============================================================================

export const client = pgTable(
  'client',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    type: clientTypeEnum('type').notNull(),
    relationType: relationTypeEnum('relation_type').default('client').notNull(),
    name: text('name').notNull(),
    civility: civilityEnum('civility'),
    siret: text('siret'),
    sector: text('sector'),
    email: text('email'),
    phone: text('phone'),
    website: text('website'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    postalCode: text('postal_code'),
    city: text('city'),
    country: text('country').default('FR').notNull(),
    ownerId: text('owner_id').references(() => member.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('client_organizationId_idx').on(table.organizationId),
    index('client_type_idx').on(table.type),
    index('client_relationType_idx').on(table.relationType),
  ]
)

export const contact = pgTable(
  'contact',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => client.id, { onDelete: 'set null' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    jobTitle: text('job_title'),
    email: text('email'),
    phone: text('phone'),
    mobile: text('mobile'),
    isPrimary: boolean('is_primary').default(false).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('contact_organizationId_idx').on(table.organizationId),
    index('contact_clientId_idx').on(table.clientId),
  ]
)

// ============================================================================
// Parc d'équipements : Client → Localisation → Équipement → Entretien.
// Équipements installés à demeure (chaudière, poêle, PAC, VMC…), pas l'outillage.
// ============================================================================

export const clientLocation = pgTable(
  'client_location',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => client.id, { onDelete: 'cascade' }),
    type: locationTypeEnum('type').notNull(),
    name: text('name').notNull(),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    postalCode: text('postal_code'),
    city: text('city'),
    country: text('country').default('FR').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('client_location_organizationId_idx').on(table.organizationId),
    index('client_location_clientId_idx').on(table.clientId),
  ]
)

export const equipment = pgTable(
  'equipment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => clientLocation.id, { onDelete: 'cascade' }),
    // Dénormalisé depuis la localisation : simplifie le cloisonnement et les
    // listes par client. Maintenu en phase avec `locationId` à l'écriture.
    clientId: uuid('client_id')
      .notNull()
      .references(() => client.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category'),
    brand: text('brand'),
    model: text('model'),
    serialNumber: text('serial_number'),
    installDate: date('install_date'),
    status: equipmentStatusEnum('status').default('en_service').notNull(),
    maintenanceFrequencyMonths: integer('maintenance_frequency_months'),
    nextMaintenanceDate: date('next_maintenance_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('equipment_organizationId_idx').on(table.organizationId),
    index('equipment_locationId_idx').on(table.locationId),
    index('equipment_clientId_idx').on(table.clientId),
  ]
)

export const equipmentMaintenance = pgTable(
  'equipment_maintenance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    equipmentId: uuid('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    type: maintenanceTypeEnum('type').default('entretien').notNull(),
    performedAt: date('performed_at').notNull(),
    performedById: text('performed_by_id').references(() => member.id, { onDelete: 'set null' }),
    cost: decimal('cost', { precision: 10, scale: 2 }),
    description: text('description'),
    nextDueDate: date('next_due_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('equipment_maintenance_organizationId_idx').on(table.organizationId),
    index('equipment_maintenance_equipmentId_idx').on(table.equipmentId),
  ]
)

export const equipmentDocument = pgTable(
  'equipment_document',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    equipmentId: uuid('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    size: integer('size'),
    uploadedById: text('uploaded_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('equipment_document_organizationId_idx').on(table.organizationId),
    index('equipment_document_equipmentId_idx').on(table.equipmentId),
  ]
)

// ============================================================================
// Dépôts & véhicules : emplacements de l'organisation (entrepôt, atelier,
// véhicule…). Un véhicule = même table avec un type + champs véhicule nullables
// (pattern société/particulier de `client`). Pas de stock/contenu (hors périmètre).
// ============================================================================

export const depot = pgTable(
  'depot',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    type: depotTypeEnum('type').notNull(),
    name: text('name').notNull(),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    postalCode: text('postal_code'),
    city: text('city'),
    country: text('country').default('FR').notNull(),
    responsibleId: text('responsible_id').references(() => member.id, { onDelete: 'set null' }),
    notes: text('notes'),
    // Champs véhicule (nullables, renseignés uniquement si type = 'vehicule').
    registrationNumber: text('registration_number'),
    brand: text('brand'),
    model: text('model'),
    year: integer('year'),
    fuelType: vehicleFuelTypeEnum('fuel_type'),
    vin: text('vin'),
    firstRegistrationDate: date('first_registration_date'),
    mileage: integer('mileage'),
    // Recalculé par le service depuis le dernier entretien (nextDueDate).
    nextMaintenanceDate: date('next_maintenance_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('depot_organizationId_idx').on(table.organizationId),
    index('depot_type_idx').on(table.type),
  ]
)

export const depotMaintenance = pgTable(
  'depot_maintenance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    depotId: uuid('depot_id')
      .notNull()
      .references(() => depot.id, { onDelete: 'cascade' }),
    type: depotMaintenanceTypeEnum('type').default('revision').notNull(),
    performedAt: date('performed_at').notNull(),
    performedById: text('performed_by_id').references(() => member.id, { onDelete: 'set null' }),
    provider: text('provider'),
    mileage: integer('mileage'),
    cost: decimal('cost', { precision: 10, scale: 2 }),
    description: text('description'),
    nextDueDate: date('next_due_date'),
    nextDueMileage: integer('next_due_mileage'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('depot_maintenance_organizationId_idx').on(table.organizationId),
    index('depot_maintenance_depotId_idx').on(table.depotId),
  ]
)

export const depotDocument = pgTable(
  'depot_document',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    depotId: uuid('depot_id')
      .notNull()
      .references(() => depot.id, { onDelete: 'cascade' }),
    category: depotDocumentCategoryEnum('category'),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    size: integer('size'),
    // Échéance (assurance, contrôle technique…) pour les rappels.
    expiresAt: date('expires_at'),
    uploadedById: text('uploaded_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('depot_document_organizationId_idx').on(table.organizationId),
    index('depot_document_depotId_idx').on(table.depotId),
  ]
)

// Rôle personnalisé par organisation (cf. cadrage v1.5). Le slug est stocké sur
// member.role et coexiste avec les slugs des rôles intégrés. `permissions` est la
// matrice ressource→actions, source de vérité pour `can()` (résolue dans OrgContext).
export const customRole = pgTable(
  'custom_role',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    color: text('color'),
    permissions: jsonb('permissions').$type<Record<string, string[]>>().default({}).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('custom_role_organizationId_idx').on(table.organizationId),
    uniqueIndex('custom_role_org_slug_idx').on(table.organizationId, table.slug),
  ]
)

// Habilitation / certification BTP d'un membre (CACES, travail en hauteur…), avec
// un document courant optionnel (le renouvellement remplace le fichier).
export const memberHabilitation = pgTable(
  'member_habilitation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    type: habilitationTypeEnum('type').notNull(),
    name: text('name').notNull(),
    issuer: text('issuer'),
    reference: text('reference'),
    issuedAt: date('issued_at'),
    // null = sans expiration.
    expiresAt: date('expires_at'),
    // Document inline (au plus un courant par habilitation).
    storagePath: text('storage_path'),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    size: integer('size'),
    uploadedById: text('uploaded_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('member_habilitation_organizationId_idx').on(table.organizationId),
    index('member_habilitation_memberId_idx').on(table.memberId),
    index('member_habilitation_expiresAt_idx').on(table.expiresAt),
  ]
)

// Matériel : un actif unitaire (1 ligne = 1 machine, n° de série). La localisation
// courante est exclusive (au plus un de currentDepotId/currentSiteId non null),
// garantie côté service.
export const tool = pgTable(
  'tool',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    kind: toolKindEnum('kind').notNull(),
    name: text('name').notNull(),
    category: text('category'),
    brand: text('brand'),
    model: text('model'),
    serialNumber: text('serial_number'),
    reference: text('reference'),
    status: toolStatusEnum('status').default('disponible').notNull(),
    // Localisation courante : SOIT un dépôt SOIT un chantier (jamais les deux).
    currentDepotId: uuid('current_depot_id').references(() => depot.id, { onDelete: 'set null' }),
    currentSiteId: uuid('current_site_id').references(() => site.id, { onDelete: 'set null' }),
    responsibleId: text('responsible_id').references(() => member.id, { onDelete: 'set null' }),
    purchaseDate: date('purchase_date'),
    purchaseCost: decimal('purchase_cost', { precision: 10, scale: 2 }),
    maintenanceFrequencyMonths: integer('maintenance_frequency_months'),
    // Recalculé par le service depuis le dernier entretien (nextDueDate).
    nextMaintenanceDate: date('next_maintenance_date'),
    // Champs machine (nullables) : carburant + compteur horaire.
    fuelLevel: fuelLevelEnum('fuel_level'),
    engineHours: integer('engine_hours'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('tool_organizationId_idx').on(table.organizationId),
    index('tool_kind_idx').on(table.kind),
    index('tool_status_idx').on(table.status),
    index('tool_currentDepotId_idx').on(table.currentDepotId),
    index('tool_currentSiteId_idx').on(table.currentSiteId),
  ]
)

export const toolMaintenance = pgTable(
  'tool_maintenance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tool.id, { onDelete: 'cascade' }),
    type: toolMaintenanceTypeEnum('type').default('controle').notNull(),
    performedAt: date('performed_at').notNull(),
    performedById: text('performed_by_id').references(() => member.id, { onDelete: 'set null' }),
    provider: text('provider'),
    // Compteur horaire au moment de l'entretien (machines).
    hours: integer('hours'),
    cost: decimal('cost', { precision: 10, scale: 2 }),
    description: text('description'),
    nextDueDate: date('next_due_date'),
    nextDueHours: integer('next_due_hours'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('tool_maintenance_organizationId_idx').on(table.organizationId),
    index('tool_maintenance_toolId_idx').on(table.toolId),
  ]
)

// Journal append-only des transferts (hard-delete). from*/to* = dépôt ou chantier.
export const toolTransfer = pgTable(
  'tool_transfer',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tool.id, { onDelete: 'cascade' }),
    fromDepotId: uuid('from_depot_id').references(() => depot.id, { onDelete: 'set null' }),
    fromSiteId: uuid('from_site_id').references(() => site.id, { onDelete: 'set null' }),
    toDepotId: uuid('to_depot_id').references(() => depot.id, { onDelete: 'set null' }),
    toSiteId: uuid('to_site_id').references(() => site.id, { onDelete: 'set null' }),
    transferredAt: timestamp('transferred_at').defaultNow().notNull(),
    transferredById: text('transferred_by_id').references(() => member.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('tool_transfer_organizationId_idx').on(table.organizationId),
    index('tool_transfer_toolId_idx').on(table.toolId),
  ]
)

// Signalement de problème : pas de soft-delete, cycle de vie via `status`.
export const toolIssue = pgTable(
  'tool_issue',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tool.id, { onDelete: 'cascade' }),
    severity: toolIssueSeverityEnum('severity').default('mineur').notNull(),
    status: toolIssueStatusEnum('status').default('ouvert').notNull(),
    description: text('description').notNull(),
    reportedById: text('reported_by_id').references(() => member.id, { onDelete: 'set null' }),
    resolvedById: text('resolved_by_id').references(() => member.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('tool_issue_organizationId_idx').on(table.organizationId),
    index('tool_issue_toolId_idx').on(table.toolId),
    index('tool_issue_status_idx').on(table.status),
  ]
)

export const toolDocument = pgTable(
  'tool_document',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tool.id, { onDelete: 'cascade' }),
    category: toolDocumentCategoryEnum('category'),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    size: integer('size'),
    uploadedById: text('uploaded_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('tool_document_organizationId_idx').on(table.organizationId),
    index('tool_document_toolId_idx').on(table.toolId),
  ]
)

// ============================================================================
// Stock — produits consommables, niveaux par localisation, mouvements, achats.
// ============================================================================

// Catégorie de produit. Une catégorie possède plusieurs sous-catégories.
export const productCategory = pgTable(
  'product_category',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [index('product_category_organizationId_idx').on(table.organizationId)]
)

export const productSubcategory = pgTable(
  'product_subcategory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => productCategory.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('product_subcategory_organizationId_idx').on(table.organizationId),
    index('product_subcategory_categoryId_idx').on(table.categoryId),
  ]
)

// Produit (fiche catalogue). La quantité n'est PAS stockée ici : elle dérive de
// la somme des `stock_level`. `weightedAvgPrice` = coût moyen pondéré (WAC),
// path-dependent, recalculé à chaque entrée (réception / stock initial).
export const product = pgTable(
  'product',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    imagePath: text('image_path'),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => productCategory.id, { onDelete: 'restrict' }),
    subcategoryId: uuid('subcategory_id')
      .notNull()
      .references(() => productSubcategory.id, { onDelete: 'restrict' }),
    unit: productUnitEnum('unit').notNull(),
    description: text('description'),
    weightedAvgPrice: decimal('weighted_avg_price', { precision: 12, scale: 4 })
      .default('0')
      .notNull(),
    initialPurchasePrice: decimal('initial_purchase_price', { precision: 12, scale: 4 }),
    // Seuil d'alerte : alerte « stock bas » quand le stock global (dépôts) passe
    // au niveau ou en dessous. `null` = pas d'alerte.
    alertThreshold: decimal('alert_threshold', { precision: 14, scale: 3 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('product_organizationId_idx').on(table.organizationId),
    index('product_categoryId_idx').on(table.categoryId),
    index('product_subcategoryId_idx').on(table.subcategoryId),
  ]
)

// ============================================================================
// Bibliothèque catalogue (référence GLOBALE, gérée par l'« Alstock Admin »).
// Ces tables ne portent PAS d'organizationId : c'est un catalogue partagé en
// lecture seule pour toutes les organisations (exception assumée, au même titre
// que les tables du plugin Better-Auth). Seules les fonctions « platform admin »
// les modifient. Quand une organisation « ajoute » un produit du catalogue, on
// crée un `product` org-scoped qui référence l'`imagePath` du catalogue (même
// bucket Supabase, pas de copie de fichier).
// ============================================================================

export const libraryCategory = pgTable(
  'library_category',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Métier d'appartenance (prépare d'autres corps d'état que plombier/chauffagiste).
    trade: text('trade').notNull().default('PLOMBIER - CHAUFFAGISTE - FRIGORISTE'),
    name: text('name').notNull(),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [index('library_category_trade_idx').on(table.trade)]
)

export const librarySubcategory = pgTable(
  'library_subcategory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => libraryCategory.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [index('library_subcategory_categoryId_idx').on(table.categoryId)]
)

export const libraryProduct = pgTable(
  'library_product',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => libraryCategory.id, { onDelete: 'restrict' }),
    subcategoryId: uuid('subcategory_id')
      .notNull()
      .references(() => librarySubcategory.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description'),
    unit: productUnitEnum('unit').notNull(),
    // Chemin de l'image dans le bucket Supabase partagé (préfixe `library/`).
    imagePath: text('image_path'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('library_product_categoryId_idx').on(table.categoryId),
    index('library_product_subcategoryId_idx').on(table.subcategoryId),
  ]
)

// Niveau de stock d'un produit sur une localisation (dépôt XOR chantier).
// Un seul niveau par couple (produit, localisation), garanti par index uniques.
export const stockLevel = pgTable(
  'stock_level',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    depotId: uuid('depot_id').references(() => depot.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => site.id, { onDelete: 'cascade' }),
    quantity: decimal('quantity', { precision: 14, scale: 3 }).default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('stock_level_organizationId_idx').on(table.organizationId),
    index('stock_level_productId_idx').on(table.productId),
    index('stock_level_depotId_idx').on(table.depotId),
    index('stock_level_siteId_idx').on(table.siteId),
    uniqueIndex('stock_level_product_depot_uidx')
      .on(table.productId, table.depotId)
      .where(sql`${table.depotId} is not null`),
    uniqueIndex('stock_level_product_site_uidx')
      .on(table.productId, table.siteId)
      .where(sql`${table.siteId} is not null`),
  ]
)

// Journal append-only des mouvements de stock (entrée, transfert, retour, ajust.).
export const stockMovement = pgTable(
  'stock_movement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    type: stockMovementTypeEnum('type').notNull(),
    fromDepotId: uuid('from_depot_id').references(() => depot.id, { onDelete: 'set null' }),
    fromSiteId: uuid('from_site_id').references(() => site.id, { onDelete: 'set null' }),
    toDepotId: uuid('to_depot_id').references(() => depot.id, { onDelete: 'set null' }),
    toSiteId: uuid('to_site_id').references(() => site.id, { onDelete: 'set null' }),
    quantity: decimal('quantity', { precision: 14, scale: 3 }).notNull(),
    // WAC (ou prix d'achat pour une réception) au moment du mouvement, pour valoriser.
    unitPrice: decimal('unit_price', { precision: 12, scale: 4 }),
    purchaseId: uuid('purchase_id').references((): AnyPgColumn => purchase.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    movedById: text('moved_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('stock_movement_organizationId_idx').on(table.organizationId),
    index('stock_movement_productId_idx').on(table.productId),
    index('stock_movement_createdAt_idx').on(table.createdAt),
  ]
)

export const supplier = pgTable(
  'supplier',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    postalCode: text('postal_code'),
    city: text('city'),
    country: text('country').default('FR').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [index('supplier_organizationId_idx').on(table.organizationId)]
)

// Achat (bon de réception). `brouillon` = en cours ; `validee` = réceptionné
// (impacte le stock + recalcule le WAC). Hors périmètre : facturation comptable.
export const purchase = pgTable(
  'purchase',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').references(() => supplier.id, { onDelete: 'set null' }),
    reference: text('reference'),
    status: purchaseStatusEnum('status').default('brouillon').notNull(),
    orderDate: date('order_date'),
    validatedAt: timestamp('validated_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('purchase_organizationId_idx').on(table.organizationId),
    index('purchase_status_idx').on(table.status),
    index('purchase_supplierId_idx').on(table.supplierId),
  ]
)

export const purchaseLine = pgTable(
  'purchase_line',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => purchase.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'restrict' }),
    quantity: decimal('quantity', { precision: 14, scale: 3 }).notNull(),
    unitPrice: decimal('unit_price', { precision: 12, scale: 4 }).notNull(),
    // Destination renseignée à la validation (dépôt XOR chantier).
    destinationDepotId: uuid('destination_depot_id').references(() => depot.id, {
      onDelete: 'set null',
    }),
    destinationSiteId: uuid('destination_site_id').references(() => site.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('purchase_line_organizationId_idx').on(table.organizationId),
    index('purchase_line_purchaseId_idx').on(table.purchaseId),
    index('purchase_line_productId_idx').on(table.productId),
  ]
)

export const site = pgTable(
  'site',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    reference: text('reference'),
    clientId: uuid('client_id')
      .notNull()
      .references(() => client.id, { onDelete: 'restrict' }),
    dealId: uuid('deal_id').references((): AnyPgColumn => deal.id, { onDelete: 'set null' }),
    status: siteStatusEnum('status').default('prepa').notNull(),
    addressLine1: text('address_line1'),
    postalCode: text('postal_code'),
    city: text('city'),
    country: text('country').default('FR').notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    actualStartDate: date('actual_start_date'),
    actualEndDate: date('actual_end_date'),
    conducteurId: text('conducteur_id').references(() => member.id, { onDelete: 'set null' }),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('site_organizationId_idx').on(table.organizationId),
    index('site_status_idx').on(table.status),
    index('site_clientId_idx').on(table.clientId),
  ]
)

export const deal = pgTable(
  'deal',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => client.id, { onDelete: 'restrict' }),
    primaryContactId: uuid('primary_contact_id').references(() => contact.id, {
      onDelete: 'set null',
    }),
    status: dealStatusEnum('status').default('en_cours').notNull(),
    stage: dealStageEnum('stage').default('nouveau').notNull(),
    estimatedAmount: decimal('estimated_amount', { precision: 12, scale: 2 }),
    currency: text('currency').default('EUR').notNull(),
    probability: integer('probability'),
    expectedCloseDate: date('expected_close_date'),
    source: dealSourceEnum('source'),
    ownerId: text('owner_id').references(() => member.id, { onDelete: 'set null' }),
    lostReason: text('lost_reason'),
    wonAt: timestamp('won_at'),
    lostAt: timestamp('lost_at'),
    siteId: uuid('site_id').references((): AnyPgColumn => site.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('deal_organizationId_idx').on(table.organizationId),
    index('deal_status_idx').on(table.status),
    index('deal_stage_idx').on(table.stage),
    index('deal_clientId_idx').on(table.clientId),
  ]
)

export const dealDocument = pgTable(
  'deal_document',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deal.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    size: integer('size'),
    uploadedById: text('uploaded_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('deal_document_organizationId_idx').on(table.organizationId),
    index('deal_document_dealId_idx').on(table.dealId),
  ]
)

export const siteDocument = pgTable(
  'site_document',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    size: integer('size'),
    uploadedById: text('uploaded_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('site_document_organizationId_idx').on(table.organizationId),
    index('site_document_siteId_idx').on(table.siteId),
  ]
)

export const siteMember = pgTable(
  'site_member',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('site_member_organizationId_idx').on(table.organizationId),
    index('site_member_siteId_idx').on(table.siteId),
    index('site_member_memberId_idx').on(table.memberId),
    // Un salarié n'est assigné qu'une fois à un chantier donné.
    uniqueIndex('site_member_site_member_unique').on(table.siteId, table.memberId),
  ]
)

export const messageAttachmentKindEnum = pgEnum('message_attachment_kind', ['image', 'audio'])

export const siteMessage = pgTable(
  'site_message',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => member.id, { onDelete: 'set null' }),
    body: text('body'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('site_message_organizationId_idx').on(table.organizationId),
    index('site_message_siteId_idx').on(table.siteId),
    index('site_message_createdAt_idx').on(table.createdAt),
  ]
)

export const siteMessageMention = pgTable(
  'site_message_mention',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => siteMessage.id, { onDelete: 'cascade' }),
    // Exactement l'un des deux est renseigné : mention d'un salarié OU d'une tâche.
    memberId: text('member_id').references(() => member.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => activity.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('site_message_mention_organizationId_idx').on(table.organizationId),
    index('site_message_mention_messageId_idx').on(table.messageId),
    index('site_message_mention_memberId_idx').on(table.memberId),
    index('site_message_mention_taskId_idx').on(table.taskId),
  ]
)

export const siteMessageAttachment = pgTable(
  'site_message_attachment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => siteMessage.id, { onDelete: 'cascade' }),
    kind: messageAttachmentKindEnum('kind').notNull(),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    size: integer('size'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('site_message_attachment_organizationId_idx').on(table.organizationId),
    index('site_message_attachment_messageId_idx').on(table.messageId),
  ]
)

export const activity = pgTable(
  'activity',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    type: activityTypeEnum('type').notNull(),
    subject: text('subject').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date'),
    status: taskStatusEnum('status').default('a_faire').notNull(),
    completedAt: timestamp('completed_at'),
    assigneeId: text('assignee_id').references(() => member.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => client.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contact.id, { onDelete: 'set null' }),
    dealId: uuid('deal_id').references(() => deal.id, { onDelete: 'set null' }),
    siteId: uuid('site_id').references(() => site.id, { onDelete: 'set null' }),
    equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
    depotId: uuid('depot_id').references(() => depot.id, { onDelete: 'set null' }),
    toolId: uuid('tool_id').references(() => tool.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('activity_organizationId_idx').on(table.organizationId),
    index('activity_assigneeId_idx').on(table.assigneeId),
    index('activity_dueDate_idx').on(table.dueDate),
    index('activity_status_idx').on(table.status),
    index('activity_equipmentId_idx').on(table.equipmentId),
    index('activity_depotId_idx').on(table.depotId),
    index('activity_toolId_idx').on(table.toolId),
  ]
)

export const taskAssignee = pgTable(
  'task_assignee',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => activity.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('task_assignee_organizationId_idx').on(table.organizationId),
    index('task_assignee_taskId_idx').on(table.taskId),
    index('task_assignee_memberId_idx').on(table.memberId),
    // Un co-assigné n'est ajouté qu'une fois à une tâche donnée.
    uniqueIndex('task_assignee_task_member_unique').on(table.taskId, table.memberId),
  ]
)

export const taskDocument = pgTable(
  'task_document',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => activity.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    size: integer('size'),
    uploadedById: text('uploaded_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('task_document_organizationId_idx').on(table.organizationId),
    index('task_document_taskId_idx').on(table.taskId),
  ]
)

export const siteReport = pgTable(
  'site_report',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'restrict' }),
    reportDate: date('report_date').notNull(),
    authorId: text('author_id').references(() => member.id, { onDelete: 'set null' }),
    weather: weatherEnum('weather'),
    temperature: integer('temperature'),
    workforceCount: integer('workforce_count'),
    progressNotes: text('progress_notes'),
    issues: text('issues'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('site_report_organizationId_idx').on(table.organizationId),
    index('site_report_siteId_idx').on(table.siteId),
    // Un seul rapport par (chantier, jour), hors rapports soft-deleted.
    uniqueIndex('site_report_site_date_unique')
      .on(table.siteId, table.reportDate)
      .where(sql`deleted_at is null`),
  ]
)

export const siteReportPhoto = pgTable(
  'site_report_photo',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    reportId: uuid('report_id')
      .notNull()
      .references(() => siteReport.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    caption: text('caption'),
    takenAt: timestamp('taken_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('site_report_photo_organizationId_idx').on(table.organizationId),
    index('site_report_photo_reportId_idx').on(table.reportId),
  ]
)

export const timeEntry = pgTable(
  'time_entry',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'restrict' }),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'restrict' }),
    workDate: date('work_date').notNull(),
    type: timeEntryTypeEnum('type').default('travail').notNull(),
    hours: decimal('hours', { precision: 5, scale: 2 }).notNull(),
    note: text('note'),
    approvedAt: timestamp('approved_at'),
    approvedById: text('approved_by_id').references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('time_entry_organizationId_idx').on(table.organizationId),
    index('time_entry_site_date_idx').on(table.siteId, table.workDate),
    index('time_entry_member_date_idx').on(table.memberId, table.workDate),
  ]
)

// ============================================================================
// Relations (plugin org + métier)
// ============================================================================

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  clients: many(client),
  sites: many(site),
}))

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}))

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, { fields: [invitation.inviterId], references: [user.id] }),
}))

export const clientRelations = relations(client, ({ one, many }) => ({
  organization: one(organization, {
    fields: [client.organizationId],
    references: [organization.id],
  }),
  owner: one(member, { fields: [client.ownerId], references: [member.id] }),
  contacts: many(contact),
  deals: many(deal),
  sites: many(site),
  locations: many(clientLocation),
}))

export const clientLocationRelations = relations(clientLocation, ({ one, many }) => ({
  organization: one(organization, {
    fields: [clientLocation.organizationId],
    references: [organization.id],
  }),
  client: one(client, { fields: [clientLocation.clientId], references: [client.id] }),
  equipments: many(equipment),
}))

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  location: one(clientLocation, {
    fields: [equipment.locationId],
    references: [clientLocation.id],
  }),
  client: one(client, { fields: [equipment.clientId], references: [client.id] }),
  maintenances: many(equipmentMaintenance),
  documents: many(equipmentDocument),
}))

export const equipmentMaintenanceRelations = relations(equipmentMaintenance, ({ one }) => ({
  equipment: one(equipment, {
    fields: [equipmentMaintenance.equipmentId],
    references: [equipment.id],
  }),
  performedBy: one(member, {
    fields: [equipmentMaintenance.performedById],
    references: [member.id],
  }),
}))

export const equipmentDocumentRelations = relations(equipmentDocument, ({ one }) => ({
  equipment: one(equipment, {
    fields: [equipmentDocument.equipmentId],
    references: [equipment.id],
  }),
  uploadedBy: one(member, {
    fields: [equipmentDocument.uploadedById],
    references: [member.id],
  }),
}))

export const depotRelations = relations(depot, ({ one, many }) => ({
  organization: one(organization, {
    fields: [depot.organizationId],
    references: [organization.id],
  }),
  responsible: one(member, { fields: [depot.responsibleId], references: [member.id] }),
  maintenances: many(depotMaintenance),
  documents: many(depotDocument),
}))

export const depotMaintenanceRelations = relations(depotMaintenance, ({ one }) => ({
  depot: one(depot, { fields: [depotMaintenance.depotId], references: [depot.id] }),
  performedBy: one(member, {
    fields: [depotMaintenance.performedById],
    references: [member.id],
  }),
}))

export const depotDocumentRelations = relations(depotDocument, ({ one }) => ({
  depot: one(depot, { fields: [depotDocument.depotId], references: [depot.id] }),
  uploadedBy: one(member, {
    fields: [depotDocument.uploadedById],
    references: [member.id],
  }),
}))

export const customRoleRelations = relations(customRole, ({ one }) => ({
  organization: one(organization, {
    fields: [customRole.organizationId],
    references: [organization.id],
  }),
}))

export const memberHabilitationRelations = relations(memberHabilitation, ({ one }) => ({
  organization: one(organization, {
    fields: [memberHabilitation.organizationId],
    references: [organization.id],
  }),
  member: one(member, { fields: [memberHabilitation.memberId], references: [member.id] }),
  uploadedBy: one(member, {
    fields: [memberHabilitation.uploadedById],
    references: [member.id],
  }),
}))

export const toolRelations = relations(tool, ({ one, many }) => ({
  organization: one(organization, {
    fields: [tool.organizationId],
    references: [organization.id],
  }),
  responsible: one(member, { fields: [tool.responsibleId], references: [member.id] }),
  currentDepot: one(depot, { fields: [tool.currentDepotId], references: [depot.id] }),
  currentSite: one(site, { fields: [tool.currentSiteId], references: [site.id] }),
  maintenances: many(toolMaintenance),
  transfers: many(toolTransfer),
  issues: many(toolIssue),
  documents: many(toolDocument),
}))

export const toolMaintenanceRelations = relations(toolMaintenance, ({ one }) => ({
  tool: one(tool, { fields: [toolMaintenance.toolId], references: [tool.id] }),
  performedBy: one(member, {
    fields: [toolMaintenance.performedById],
    references: [member.id],
  }),
}))

export const toolTransferRelations = relations(toolTransfer, ({ one }) => ({
  tool: one(tool, { fields: [toolTransfer.toolId], references: [tool.id] }),
  transferredBy: one(member, {
    fields: [toolTransfer.transferredById],
    references: [member.id],
  }),
}))

export const toolIssueRelations = relations(toolIssue, ({ one }) => ({
  tool: one(tool, { fields: [toolIssue.toolId], references: [tool.id] }),
  reportedBy: one(member, { fields: [toolIssue.reportedById], references: [member.id] }),
  resolvedBy: one(member, { fields: [toolIssue.resolvedById], references: [member.id] }),
}))

export const toolDocumentRelations = relations(toolDocument, ({ one }) => ({
  tool: one(tool, { fields: [toolDocument.toolId], references: [tool.id] }),
  uploadedBy: one(member, {
    fields: [toolDocument.uploadedById],
    references: [member.id],
  }),
}))

export const contactRelations = relations(contact, ({ one }) => ({
  client: one(client, { fields: [contact.clientId], references: [client.id] }),
}))

export const dealRelations = relations(deal, ({ one, many }) => ({
  client: one(client, { fields: [deal.clientId], references: [client.id] }),
  primaryContact: one(contact, {
    fields: [deal.primaryContactId],
    references: [contact.id],
  }),
  site: one(site, { fields: [deal.siteId], references: [site.id] }),
  documents: many(dealDocument),
}))

export const dealDocumentRelations = relations(dealDocument, ({ one }) => ({
  deal: one(deal, { fields: [dealDocument.dealId], references: [deal.id] }),
  uploadedBy: one(member, {
    fields: [dealDocument.uploadedById],
    references: [member.id],
  }),
}))

export const siteRelations = relations(site, ({ one, many }) => ({
  organization: one(organization, {
    fields: [site.organizationId],
    references: [organization.id],
  }),
  client: one(client, { fields: [site.clientId], references: [client.id] }),
  deal: one(deal, { fields: [site.dealId], references: [deal.id] }),
  reports: many(siteReport),
  timeEntries: many(timeEntry),
  documents: many(siteDocument),
  team: many(siteMember),
  messages: many(siteMessage),
}))

export const siteMemberRelations = relations(siteMember, ({ one }) => ({
  site: one(site, { fields: [siteMember.siteId], references: [site.id] }),
  member: one(member, { fields: [siteMember.memberId], references: [member.id] }),
}))

export const siteMessageRelations = relations(siteMessage, ({ one, many }) => ({
  site: one(site, { fields: [siteMessage.siteId], references: [site.id] }),
  author: one(member, { fields: [siteMessage.authorId], references: [member.id] }),
  mentions: many(siteMessageMention),
  attachments: many(siteMessageAttachment),
}))

export const siteMessageMentionRelations = relations(siteMessageMention, ({ one }) => ({
  message: one(siteMessage, {
    fields: [siteMessageMention.messageId],
    references: [siteMessage.id],
  }),
  member: one(member, { fields: [siteMessageMention.memberId], references: [member.id] }),
  task: one(activity, { fields: [siteMessageMention.taskId], references: [activity.id] }),
}))

export const siteMessageAttachmentRelations = relations(siteMessageAttachment, ({ one }) => ({
  message: one(siteMessage, {
    fields: [siteMessageAttachment.messageId],
    references: [siteMessage.id],
  }),
}))

export const taskAssigneeRelations = relations(taskAssignee, ({ one }) => ({
  task: one(activity, { fields: [taskAssignee.taskId], references: [activity.id] }),
  member: one(member, { fields: [taskAssignee.memberId], references: [member.id] }),
}))

export const taskDocumentRelations = relations(taskDocument, ({ one }) => ({
  task: one(activity, { fields: [taskDocument.taskId], references: [activity.id] }),
  uploadedBy: one(member, { fields: [taskDocument.uploadedById], references: [member.id] }),
}))

export const siteDocumentRelations = relations(siteDocument, ({ one }) => ({
  site: one(site, { fields: [siteDocument.siteId], references: [site.id] }),
  uploadedBy: one(member, {
    fields: [siteDocument.uploadedById],
    references: [member.id],
  }),
}))

export const siteReportRelations = relations(siteReport, ({ one, many }) => ({
  site: one(site, { fields: [siteReport.siteId], references: [site.id] }),
  photos: many(siteReportPhoto),
}))

export const siteReportPhotoRelations = relations(siteReportPhoto, ({ one }) => ({
  report: one(siteReport, { fields: [siteReportPhoto.reportId], references: [siteReport.id] }),
}))

export const timeEntryRelations = relations(timeEntry, ({ one }) => ({
  site: one(site, { fields: [timeEntry.siteId], references: [site.id] }),
  member: one(member, { fields: [timeEntry.memberId], references: [member.id] }),
}))

export const productCategoryRelations = relations(productCategory, ({ many }) => ({
  subcategories: many(productSubcategory),
  products: many(product),
}))

export const productSubcategoryRelations = relations(productSubcategory, ({ one, many }) => ({
  category: one(productCategory, {
    fields: [productSubcategory.categoryId],
    references: [productCategory.id],
  }),
  products: many(product),
}))

export const productRelations = relations(product, ({ one, many }) => ({
  organization: one(organization, {
    fields: [product.organizationId],
    references: [organization.id],
  }),
  category: one(productCategory, {
    fields: [product.categoryId],
    references: [productCategory.id],
  }),
  subcategory: one(productSubcategory, {
    fields: [product.subcategoryId],
    references: [productSubcategory.id],
  }),
  stockLevels: many(stockLevel),
  movements: many(stockMovement),
}))

export const stockLevelRelations = relations(stockLevel, ({ one }) => ({
  product: one(product, { fields: [stockLevel.productId], references: [product.id] }),
  depot: one(depot, { fields: [stockLevel.depotId], references: [depot.id] }),
  site: one(site, { fields: [stockLevel.siteId], references: [site.id] }),
}))

export const libraryCategoryRelations = relations(libraryCategory, ({ many }) => ({
  subcategories: many(librarySubcategory),
  products: many(libraryProduct),
}))

export const librarySubcategoryRelations = relations(librarySubcategory, ({ one, many }) => ({
  category: one(libraryCategory, {
    fields: [librarySubcategory.categoryId],
    references: [libraryCategory.id],
  }),
  products: many(libraryProduct),
}))

export const libraryProductRelations = relations(libraryProduct, ({ one }) => ({
  category: one(libraryCategory, {
    fields: [libraryProduct.categoryId],
    references: [libraryCategory.id],
  }),
  subcategory: one(librarySubcategory, {
    fields: [libraryProduct.subcategoryId],
    references: [librarySubcategory.id],
  }),
}))

export const stockMovementRelations = relations(stockMovement, ({ one }) => ({
  product: one(product, { fields: [stockMovement.productId], references: [product.id] }),
  purchase: one(purchase, { fields: [stockMovement.purchaseId], references: [purchase.id] }),
  movedBy: one(member, { fields: [stockMovement.movedById], references: [member.id] }),
}))

export const supplierRelations = relations(supplier, ({ many }) => ({
  purchases: many(purchase),
}))

export const purchaseRelations = relations(purchase, ({ one, many }) => ({
  organization: one(organization, {
    fields: [purchase.organizationId],
    references: [organization.id],
  }),
  supplier: one(supplier, { fields: [purchase.supplierId], references: [supplier.id] }),
  lines: many(purchaseLine),
}))

export const purchaseLineRelations = relations(purchaseLine, ({ one }) => ({
  purchase: one(purchase, { fields: [purchaseLine.purchaseId], references: [purchase.id] }),
  product: one(product, { fields: [purchaseLine.productId], references: [product.id] }),
  destinationDepot: one(depot, {
    fields: [purchaseLine.destinationDepotId],
    references: [depot.id],
  }),
  destinationSite: one(site, {
    fields: [purchaseLine.destinationSiteId],
    references: [site.id],
  }),
}))
