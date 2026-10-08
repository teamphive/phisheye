import { Link, useLocation } from "react-router"
import {
  ActivityIcon,
  LayoutDashboardIcon,
  MailIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { useSession } from "@/components/session-provider"
import { buttonVariants } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const mainNavigation = [
  { to: "/", label: "Übersicht", icon: LayoutDashboardIcon },
  { to: "/analysen", label: "Analysen", icon: MailIcon },
]

export function AppSidebar() {
  const { permissions } = useSession()
  const { pathname } = useLocation()

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to)

  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 h-svh border-r border-border"
    >
      <SidebarHeader className="gap-4 p-3">
        <Link to="/" className="flex items-center gap-2 px-2 py-1">
          <BrandMark className="size-6 text-primary" />
          <span className="text-base font-semibold tracking-tight">
            phisheye
          </span>
        </Link>

        {permissions.analyze ? (
          <Link
            to="/analysen/neu"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            <PlusIcon />
            Neue Analyse
          </Link>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3">
          <SidebarMenu>
            {mainNavigation.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  isActive={isActive(item.to)}
                  render={<Link to={item.to} />}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive("/team")}
              render={<Link to="/team" />}
            >
              <UsersIcon />
              <span>Team</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {permissions.monitor ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive("/monitoring")}
                render={<Link to="/monitoring" />}
              >
                <ActivityIcon />
                <span>Monitoring</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
