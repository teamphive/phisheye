import { useKcContext } from "../KcContext"

/**
 * Leads to Keycloak's list of other sign-in methods, e.g. backup codes. Shown
 * only when the realm offers an alternative for the current step.
 */
export function TryAnotherWay() {
  const { kcContext } = useKcContext()

  if (!kcContext.auth?.showTryAnotherWayLink) return null

  return (
    <form
      action={kcContext.url.loginAction}
      method="post"
      className="text-center"
    >
      <input type="hidden" name="tryAnotherWay" value="on" />
      <button type="submit" className="text-xs text-primary hover:underline">
        Andere Methode verwenden
      </button>
    </form>
  )
}
