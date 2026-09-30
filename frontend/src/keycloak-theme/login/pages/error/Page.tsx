/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/error/Page.tsx" --revert
 */

import { kcSanitize } from "@keycloakify/login-ui/kcSanitize"
import { assert } from "tsafe/assert"

import { buttonVariants } from "@/components/ui/button"
import { NoticePage } from "../../components/NoticePage"
import { useKcContext } from "../../KcContext"

// Most often an expired or already used link from a mail. Keycloak's own
// message says which.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "error.ftl")

  const { message, skipLink, client } = kcContext

  return (
    <NoticePage
      title="Fehler"
      heading="Das hat nicht geklappt"
      tone="error"
      actions={
        !skipLink && client?.baseUrl ? (
          <a
            href={client.baseUrl}
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            Zu phisheye
          </a>
        ) : null
      }
    >
      <p dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
    </NoticePage>
  )
}
