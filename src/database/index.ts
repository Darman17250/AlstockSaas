import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'
import { env } from '@/config/env'

const databaseUrl = env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Please set it in your .env file.')
}

// Singleton sur globalThis en dev : évite que le HMR n'accumule des connexions
// (saturation du pool) et ne relance des timers `max_lifetime` (avertissements
// TimeoutNegativeWarning). En prod, une seule instance de module suffit.
const globalForDb = globalThis as unknown as {
  __queryClient?: ReturnType<typeof postgres>
}

const queryClient = globalForDb.__queryClient ?? postgres(databaseUrl)

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__queryClient = queryClient
}

export const db = drizzle({ client: queryClient, schema })
