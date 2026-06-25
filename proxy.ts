import { type NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

import { APP_COOKIE_NAME } from '@/lib/constants'

/**
 * Proxy (convention Next 16, remplace `middleware.ts`).
 * Protège les routes applicatives : exige une session. Le contrôle de
 * l'organisation active (redirection onboarding) est fait dans le layout
 * serveur `(main)` qui a accès à la base — ici, simple présence du cookie.
 */
export default function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request, { cookiePrefix: APP_COOKIE_NAME })

  if (!sessionCookie) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding',
    '/clients/:path*',
    '/affaires/:path*',
    '/chantiers/:path*',
    '/taches/:path*',
    '/equipements/:path*',
    '/depots/:path*',
    '/equipe/:path*',
  ],
}
