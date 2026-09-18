import { Outlet } from "react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { NotificationsProvider } from "@/components/notifications-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppLayout() {
  return (
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
  )
}
