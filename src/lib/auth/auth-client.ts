import { emailOTPClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { getBaseUrl } from '../utils'
import { ac, roles } from './permissions'

/**
 * Auth Client
 *
 * Core authentication client with email OTP and organization support.
 *
 * For billing operations, use the useBilling() hook from '@/lib/billing/client'.
 * The billing client plugin is configured separately to maintain proper TypeScript types.
 *
 * @see lib/billing/client.ts for billing configuration
 * @see lib/billing/hooks.ts for billing React hooks
 */
// Dans le navigateur, on cible toujours l'origine courante : les appels auth
// restent same-origin quel que soit le port de dev (évite tout CORS). Côté
// serveur (SSR), on retombe sur l'URL publique configurée.
const authBaseURL = typeof window !== 'undefined' ? window.location.origin : getBaseUrl()

export const client = createAuthClient({
  baseURL: authBaseURL,
  plugins: [emailOTPClient(), organizationClient({ ac, roles })],
  fetchOptions: {
    onError(error) {
      console.error('Auth error:', error)
    },
    onSuccess(data) {
      console.log('Auth action successful:', data)
    },
  },
})

export const { signIn, signUp, signOut, useSession } = client
