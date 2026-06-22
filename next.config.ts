import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable standalone output for Docker optimization
  // This reduces the Docker image size by including only necessary files
  // output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
}

// Sentry (boilerplate ShipFree) désactivé : le plugin build pointait sur l'org
// `quibi-tt`/projet `elixir` qui ne sont pas les nôtres. L'init runtime
// (sentry.*.config.ts) reste inerte tant que NEXT_PUBLIC_SENTRY_DSN n'est pas défini.
// Pour réactiver : réimporter `withSentryConfig` et renseigner org/project + token.
export default nextConfig
