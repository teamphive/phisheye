import { Button } from "@/components/ui/button"
import { useKcContext } from "../KcContext"

/**
 * Leaves a required action that was opened from the app, e.g. changing the
 * password from the settings. Keycloak skips the action on `cancel-aia`. On a
 * required action during login there is no way around it, so nothing shows.
 */
export function CancelButton() {
  const { kcContext } = useKcContext()

  if (!kcContext.isAppInitiatedAction) return null

  return (
    <Button
      type="submit"
      name="cancel-aia"
      value="true"
      variant="outline"
      size="lg"
      className="w-full"
      formNoValidate
    >
      Abbrechen
    </Button>
  )
}
