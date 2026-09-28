import { kcSanitize } from "@keycloakify/login-ui/kcSanitize"

import { FieldError } from "@/components/ui/field"

/**
 * An error Keycloak reports for a form field. Keycloak renders the text
 * itself, so it may carry markup.
 */
export function KcFieldError({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  // FieldError renders nothing without children, so the markup goes one
  // level down.
  return (
    <FieldError aria-live="polite" className={className}>
      <span dangerouslySetInnerHTML={{ __html: kcSanitize(message) }} />
    </FieldError>
  )
}
