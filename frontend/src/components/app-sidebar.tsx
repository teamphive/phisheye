import { Link, NavLink } from "react-router"
import { ActivityIcon, MailIcon, PlusIcon, UsersIcon } from "lucide-react"

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
  { to: "/analysen", label: "Analysen", icon: MailIcon },
  { to: "/team", label: "Team", icon: UsersIcon },
]

export function AppSidebar() {
  const { permissions } = useSession()

  return (
    <Sidebar collapsible="none" className="border-border sticky top-0 h-svh border-r">
      <SidebarHeader className="gap-3">
        <Link
          to="/"
          className="hover:bg-muted flex items-center gap-2.5 rounded-md px-2 py-1.5"
        >
          <BrandMark className="text-primary size-7" />
          <span className="text-[17px] font-bold tracking-tight">phisheye</span>
        </Link>

        {permissions.analyze ? (
          <Link
            to="/analysen/neu"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full font-semibold"
            )}
          >
            <PlusIcon className="size-4" />
            Neue Analyse
          </Link>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {mainNavigation.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton render={<NavLink to={item.to} />}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {permissions.monitor ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<NavLink to="/monitoring" />}>
                <ActivityIcon />
                <span>Monitoring</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  )
}
