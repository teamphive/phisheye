import { kcSanitize } from "@keycloakify/login-ui/kcSanitize"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react"

import { Alert, AlertTitle } from "@/components/ui/alert"
import { useKcContext } from "../KcContext"

const icons = {
  error: CircleAlertIcon,
  warning: CircleAlertIcon,
  success: CircleCheckIcon,
  info: InfoIcon,
}

/**
 * The page-wide message Keycloak sends along, e.g. an expired link or a
 * locked account. Keycloak renders the text itself, so it may carry markup.
 */
export function KcMessage() {
  const { kcContext } = useKcContext()
  const { message, isAppInitiatedAction } = kcContext

  if (message === undefined) return null
  // Someone who opened an action from the app knows why they are here.
  if (message.type === "warning" && isAppInitiatedAction) return null

  const Icon = icons[message.type]

  return (
    <Alert variant={message.type === "error" ? "destructive" : "default"}>
      <Icon />
      <AlertTitle
        className="font-normal"
        dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }}
      />
    </Alert>
  )
}
