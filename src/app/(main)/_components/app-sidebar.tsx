'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Boxes,
  Briefcase,
  Building,
  HardHat,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Users,
  UsersRound,
  Warehouse,
  Wrench,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { ScannerDialog } from '@/components/qr/scanner-dialog'
import { client } from '@/lib/auth/auth-client'
import {
  can,
  type AppRole,
  type BusinessResource,
  type PermissionMatrix,
} from '@/lib/auth/permissions'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  /** Ressource requise en lecture pour afficher l'entrée. */
  resource?: BusinessResource
  /** Rôles autorisés (si pas de ressource gérée par l'access-control). */
  roles?: AppRole[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/clients', icon: Users, resource: 'client' },
  { label: 'Affaires', href: '/affaires', icon: Briefcase, resource: 'deal' },
  { label: 'Chantiers', href: '/chantiers', icon: HardHat, resource: 'site' },
  { label: 'Dépôts', href: '/depots', icon: Warehouse, resource: 'depot' },
  { label: 'Matériel', href: '/materiel', icon: Wrench, resource: 'tool' },
  { label: 'Stock', href: '/stock', icon: Boxes, resource: 'product' },
  { label: 'Achats', href: '/achats', icon: ShoppingCart, resource: 'purchase' },
  { label: 'Tâches', href: '/taches', icon: ListChecks, resource: 'activity' },
  { label: 'Équipe', href: '/equipe', icon: UsersRound, roles: ['owner', 'admin'] },
]

interface AppSidebarProps {
  orgName: string
  role: string
  permissions: PermissionMatrix
  user: { name: string; email: string }
  isPlatformAdmin?: boolean
}

export const AppSidebar = ({
  orgName,
  role,
  permissions,
  user,
  isPlatformAdmin,
}: AppSidebarProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const [scannerOpen, setScannerOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.resource) return can({ role, permissions }, item.resource, 'read')
    if (item.roles) return item.roles.includes(role as AppRole)
    return true
  })

  const handleSignOut = async () => {
    await client.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className='flex items-center gap-2 px-2 py-1.5'>
          <div className='flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
            <Building className='size-4' />
          </div>
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold'>{orgName}</p>
            <p className='truncate text-xs capitalize text-muted-foreground'>{role}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <item.icon className='size-4' />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Outils</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setScannerOpen(true)} tooltip='Scanner un QR'>
                  <ScanLine className='size-4' />
                  <span>Scanner</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isPlatformAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href='/admin/bibliotheque' />}
                    isActive={pathname.startsWith('/admin')}
                    tooltip='Alstock Admin'
                  >
                    <ShieldCheck className='size-4' />
                    <span>Alstock Admin</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className='min-w-0 px-2 py-1'>
              <p className='truncate text-sm font-medium'>{user.name || user.email}</p>
              <p className='truncate text-xs text-muted-foreground'>{user.email}</p>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip='Se déconnecter'>
              <LogOut className='size-4' />
              <span>Se déconnecter</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <ScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} />
    </Sidebar>
  )
}
