import type { ReactNode } from "react"

import { useSession } from "@/components/session-provider"
import type { Permissions } from "@/lib/permissions"
import { ForbiddenPage } from "@/pages/forbidden"

/**
 * Keeps a page from rendering, and from loading anything, for someone whose
 * role does not allow it. The address stays, the page says why.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: keyof Permissions
  children: ReactNode
}) {
  const { permissions } = useSession()

  return permissions[permission] ? (
    children
  ) : (
    <ForbiddenPage permission={permission} />
  )
}
