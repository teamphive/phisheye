import { authEnabled, keycloak } from "@/lib/keycloak"
import { initialsOf } from "@/lib/format"
import { currentUser, type CurrentUser } from "@/mocks/session"

let cached: CurrentUser | undefined

/**
 * The signed in user, read from the token. Falls back to the placeholder data
 * while no Keycloak is configured. The result is kept: a token carries the
 * same name and address for as long as the page is open.
 */
export function sessionUser(): CurrentUser {
  if (cached) return cached

  const claims = keycloak.tokenParsed
  if (!authEnabled || !claims) return currentUser

  const name: string = claims.name ?? claims.preferred_username ?? "Unbekannt"

  cached = {
    // isOperator still comes from the placeholder: the roles live in the app
    // database, not in the realm, so GET /me has to deliver them later.
    ...currentUser,
    name,
    email: claims.email ?? "",
    initials: initialsOf(name),
  }

  return cached
}
