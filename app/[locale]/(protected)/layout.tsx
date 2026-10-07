import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { DashBoardLayoutAppSidebar } from '@/components/app-sidebar/dashboard-layout-app-sidebar'
import { MobileHeader, DesktopHeader } from '@/components/app-sidebar'
import { requirePageRoles } from '@/lib/auth/page-guard'
import { hasAdminCapability } from '@/lib/auth/admin-capabilities'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await requirePageRoles(
    locale,
    ["trial_user", "platform_admin"],
    "/dashboard",
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <SidebarProvider defaultOpen={true}>
          <DashBoardLayoutAppSidebar
            canAccessAdministration={hasAdminCapability(
              session.user,
              "trial.read",
            )}
          />
          <SidebarInset className="flex flex-col w-full overflow-y-auto h-svh">
            <MobileHeader actor={session.user} />
            <DesktopHeader actor={session.user} />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </SidebarInset>
          <Toaster />
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
