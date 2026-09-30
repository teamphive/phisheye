/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/delete-credential/Page.tsx" --revert
 */

import { useState } from "react"
import { TrashIcon } from "lucide-react"
import { assert } from "tsafe/assert"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { CancelButton } from "../../components/CancelButton"
import { NoticePage } from "../../components/NoticePage"
import { useKcContext } from "../../KcContext"

// Opened from the settings, "Entfernen" next to an authenticator app. Keycloak
// deletes on any submit that does not carry cancel-aia.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "delete-credential.ftl")

  const { url, credentialLabel } = kcContext
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <NoticePage
      title="Gerät entfernen"
      heading={`„${credentialLabel}“ entfernen?`}
      tone="error"
      icon={TrashIcon}
      actions={
        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-2.5"
          onSubmit={() => setIsSubmitting(true)}
        >
          <Button
            type="submit"
            name="accept"
            value="true"
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && <Spinner />}
            Entfernen
          </Button>
          <CancelButton />
        </form>
      }
    >
      <p>Danach kannst du dich damit nicht mehr anmelden.</p>
    </NoticePage>
  )
}
