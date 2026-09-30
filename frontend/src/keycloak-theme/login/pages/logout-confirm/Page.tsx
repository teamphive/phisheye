/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/logout-confirm/Page.tsx" --revert
 */

import { useState } from "react"
import { LogOutIcon } from "lucide-react"
import { assert } from "tsafe/assert"

import { Button, buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { NoticePage } from "../../components/NoticePage"
import { useKcContext } from "../../KcContext"

// Only when a logout reaches Keycloak without the token, the app's own logout
// passes it along and skips this page.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "logout-confirm.ftl")

  const { url, client, logoutConfirm } = kcContext
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <NoticePage
      title="Abmelden"
      heading="Abmelden?"
      tone="info"
      icon={LogOutIcon}
      actions={
        <form
          action={url.logoutConfirmAction}
          method="post"
          className="flex flex-col gap-2.5"
          onSubmit={() => setIsSubmitting(true)}
        >
          <input type="hidden" name="session_code" value={logoutConfirm.code} />
          <Button
            type="submit"
            name="confirmLogout"
            value="true"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && <Spinner />}
            Abmelden
          </Button>
          {!logoutConfirm.skipLink && client.baseUrl ? (
            <a
              href={client.baseUrl}
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "w-full",
              })}
            >
              Zurück zu phisheye
            </a>
          ) : null}
        </form>
      }
    >
      <p>Du wirst auf diesem Gerät von phisheye abgemeldet.</p>
    </NoticePage>
  )
}
