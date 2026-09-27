import { Outlet } from "react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { NotificationsProvider } from "@/components/notifications-provider"
import { SessionProvider } from "@/components/session-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// The session only matters behind the login, the auth pages render without it.
export function AppLayout() {
  return (
    <SessionProvider>
      <NotificationsProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppTopbar />
            <main className="px-7 pt-6 pb-16">
              <div className="mx-auto max-w-[1180px]">
                <Outlet />
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </NotificationsProvider>
    </SessionProvider>
  )
}
