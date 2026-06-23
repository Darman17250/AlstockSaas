// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

// N'initialise Sentry que si un vrai DSN est fourni (évite l'erreur console
// "Invalid Sentry Dsn" quand l'observabilité n'est pas configurée).
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1,
    enableLogs: true,
    sendDefaultPii: true,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
