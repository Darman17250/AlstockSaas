import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { db } from '@/database'
import { organization } from '@/database/schema'
import { auth } from '@/lib/auth/auth'
import { getOrgContext } from '@/lib/auth/org-context'
import { isPlatformAdminEmail } from '@/lib/auth/platform-admin'
import { AppSidebar } from './_components/app-sidebar'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login')
  }

  const ctx = await getOrgContext()
  // Authentifié mais sans organisation active → onboarding.
  if (!ctx) {
    redirect('/onboarding')
  }

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId))
    .limit(1)

  return (
    <SidebarProvider>
      <AppSidebar
        orgName={org?.name ?? 'Mon entreprise'}
        role={ctx.role}
        permissions={ctx.permissions}
        user={{ name: session.user.name, email: session.user.email }}
        isPlatformAdmin={isPlatformAdminEmail(session.user.email)}
      />
      <SidebarInset>
        <header className='flex h-14 items-center gap-2 border-b px-4'>
          <SidebarTrigger />
        </header>
        <div className='flex-1'>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
