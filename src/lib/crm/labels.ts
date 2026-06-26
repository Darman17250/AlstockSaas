/** Libellés FR des enums CRM (UI). Constantes pures, importables partout. */

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  societe: 'Société',
  particulier: 'Particulier',
}

export const RELATION_TYPE_LABELS: Record<string, string> = {
  client: 'Client',
  prestataire: 'Prestataire',
}

export const CIVILITY_LABELS: Record<string, string> = {
  monsieur: 'Monsieur',
  madame: 'Madame',
}

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  appel: 'Appel',
  email: 'Email',
  reunion: 'Réunion',
  visite: 'Visite',
  note: 'Note',
  tache: 'Tâche',
}

/** Types d'activité représentant une communication/interaction (hors `tache`). */
export const COMMUNICATION_TYPES = ['appel', 'email', 'reunion', 'visite', 'note'] as const

/** Statuts d'une tâche (entité `activity`, type `tache`). */
export const TASK_STATUS_LABELS: Record<string, string> = {
  a_faire: 'À faire',
  fait: 'Fait',
  annule: 'Annulé',
}

export const DEAL_STATUS_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  gagnee: 'Gagnée',
  perdue: 'Perdue',
}

export const DEAL_STAGE_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  qualification: 'Qualification',
  proposition: 'Proposition',
  negociation: 'Négociation',
}

export const DEAL_SOURCE_LABELS: Record<string, string> = {
  site_web: 'Site web',
  recommandation: 'Recommandation',
  appel_entrant: 'Appel entrant',
  prospection: 'Prospection',
  salon: 'Salon',
  autre: 'Autre',
}

/** Ordre des colonnes du kanban (affaires en cours). */
export const DEAL_STAGES = ['nouveau', 'qualification', 'proposition', 'negociation'] as const

/** Statuts d'un chantier (entité `site`). */
export const SITE_STATUS_LABELS: Record<string, string> = {
  prepa: 'Préparation',
  en_cours: 'En cours',
  en_pause: 'En pause',
  termine: 'Terminé',
  annule: 'Annulé',
}

/** Ordre des statuts de chantier (filtre + Select formulaire). */
export const SITE_STATUSES = ['prepa', 'en_cours', 'en_pause', 'termine', 'annule'] as const

/** Météo d'un rapport de chantier. */
export const WEATHER_LABELS: Record<string, string> = {
  ensoleille: 'Ensoleillé',
  nuageux: 'Nuageux',
  pluvieux: 'Pluvieux',
  neigeux: 'Neigeux',
  venteux: 'Venteux',
}

export const WEATHER_VALUES = ['ensoleille', 'nuageux', 'pluvieux', 'neigeux', 'venteux'] as const

/** Types de localisation client (parc d'équipements). */
export const LOCATION_TYPE_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  local_commercial: 'Local commercial',
  immeuble: 'Immeuble',
  terrain: 'Terrain',
  autre: 'Autre',
}

/** Statuts d'un équipement installé. */
export const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  en_service: 'En service',
  en_panne: 'En panne',
  hors_service: 'Hors service',
  a_remplacer: 'À remplacer',
}

/** Types d'intervention d'entretien. */
export const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  entretien: 'Entretien',
  reparation: 'Réparation',
  installation: 'Installation',
  controle: 'Contrôle',
}

/** Suggestions courantes de catégories d'équipement (datalist, champ libre). */
export const EQUIPMENT_CATEGORY_SUGGESTIONS = [
  'Chaudière',
  'Poêle à bois',
  'Pompe à chaleur',
  'Climatisation',
  'VMC',
  'Chauffe-eau',
  'Adoucisseur',
  'Ballon thermodynamique',
  'Radiateur',
  'Portail',
  'Alarme',
] as const

/** Types de dépôt (emplacements de l'organisation). */
export const DEPOT_TYPE_LABELS: Record<string, string> = {
  entrepot: 'Entrepôt',
  atelier: 'Atelier',
  vehicule: 'Véhicule',
  autre: 'Autre',
}

export const DEPOT_TYPES = ['entrepot', 'atelier', 'vehicule', 'autre'] as const

/** Types d'entretien d'un dépôt/véhicule. */
export const DEPOT_MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  revision: 'Révision',
  vidange: 'Vidange',
  pneus: 'Pneus',
  controle_technique: 'Contrôle technique',
  reparation: 'Réparation',
  carrosserie: 'Carrosserie',
  autre: 'Autre',
}

/** Carburant d'un véhicule. */
export const FUEL_TYPE_LABELS: Record<string, string> = {
  essence: 'Essence',
  diesel: 'Diesel',
  gpl: 'GPL',
  electrique: 'Électrique',
  hybride: 'Hybride',
  autre: 'Autre',
}

/** Catégories de document de dépôt/véhicule. */
export const DEPOT_DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  carte_grise: 'Carte grise',
  assurance: 'Assurance',
  controle_technique: 'Contrôle technique',
  facture: 'Facture',
  autre: 'Autre',
}

// ============================================================================
// Matériel (parc d'outillage & machines de l'organisation)
// ============================================================================

/** Nature d'un matériel : outil à main ou machine/engin. */
export const TOOL_KIND_LABELS: Record<string, string> = {
  outil: 'Outillage',
  machine: 'Machine',
}

export const TOOL_KINDS = ['outil', 'machine'] as const

/** Statut courant d'un matériel. */
export const TOOL_STATUS_LABELS: Record<string, string> = {
  disponible: 'Disponible',
  en_service: 'En service',
  en_panne: 'En panne',
  en_reparation: 'En réparation',
  hors_service: 'Hors service',
  perdu: 'Perdu',
}

export const TOOL_STATUSES = [
  'disponible',
  'en_service',
  'en_panne',
  'en_reparation',
  'hors_service',
  'perdu',
] as const

/** Types d'entretien d'un matériel. */
export const TOOL_MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  controle: 'Contrôle',
  reparation: 'Réparation',
  revision: 'Révision',
  etalonnage: 'Étalonnage',
  remplacement_piece: 'Remplacement de pièce',
  autre: 'Autre',
}

/** Catégories de document de matériel. */
export const TOOL_DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  facture: 'Facture',
  manuel: 'Manuel',
  garantie: 'Garantie',
  photo: 'Photo',
  autre: 'Autre',
}

/** Niveau de carburant (machines). */
export const FUEL_LEVEL_LABELS: Record<string, string> = {
  vide: 'Vide',
  quart: '1/4',
  moitie: '1/2',
  trois_quarts: '3/4',
  plein: 'Plein',
}

export const FUEL_LEVELS = ['vide', 'quart', 'moitie', 'trois_quarts', 'plein'] as const

/** Gravité d'un problème signalé sur un matériel. */
export const TOOL_ISSUE_SEVERITY_LABELS: Record<string, string> = {
  mineur: 'Mineur',
  majeur: 'Majeur',
  bloquant: 'Bloquant',
}

export const TOOL_ISSUE_SEVERITIES = ['mineur', 'majeur', 'bloquant'] as const

/** Statut d'un problème signalé. */
export const TOOL_ISSUE_STATUS_LABELS: Record<string, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
}

export const TOOL_ISSUE_STATUSES = ['ouvert', 'en_cours', 'resolu'] as const

/** Suggestions de catégorie pour l'outillage (datalist, champ libre). */
export const TOOL_CATEGORY_SUGGESTIONS = [
  'Perceuse',
  'Perforateur',
  'Meuleuse',
  'Visseuse',
  'Scie',
  'Ponceuse',
  'Compresseur',
  'Niveau laser',
  'Poste à souder',
  'Aspirateur',
] as const

/** Suggestions de catégorie pour les machines/engins (datalist, champ libre). */
export const MACHINE_CATEGORY_SUGGESTIONS = [
  'Nacelle',
  'Pelleteuse',
  'Mini-pelle',
  'Chargeuse',
  'Télescopique',
  'Groupe électrogène',
  'Bétonnière',
  'Compacteur',
  'Dumper',
] as const

/** Montant (coût) formaté en euros. `null` si absent/invalide. */
export const formatCost = (amount: string | number | null | undefined): string | null => {
  if (amount === null || amount === undefined || amount === '') return null
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (Number.isNaN(value)) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

/** Montant d'affaire formaté en euros (ou devise fournie). `null` si absent. */
export const formatDealAmount = (
  amount: string | number | null | undefined,
  currency = 'EUR'
): string | null => {
  if (amount === null || amount === undefined || amount === '') return null
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (Number.isNaN(value)) return null
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}
