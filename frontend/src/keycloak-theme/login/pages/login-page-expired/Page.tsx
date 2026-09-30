/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-page-expired/Page.tsx" --revert
 */

import { assert } from "tsafe/assert"

import { buttonVariants } from "@/components/ui/button"
import { NoticePage } from "../../components/NoticePage"
import { useKcContext } from "../../KcContext"

// A login left open too long, or one that went on in another tab
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-page-expired.ftl")

  const { url } = kcContext

  return (
    <NoticePage
      title="Seite abgelaufen"
      heading="Seite abgelaufen"
      tone="warning"
      actions={
        <>
          <a
            href={url.loginRestartFlowUrl}
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            Anmeldung neu starten
          </a>
          <a
            href={url.loginAction}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "w-full",
            })}
          >
            Weitermachen, wo ich war
          </a>
        </>
      }
    >
      <p>
        Die Anmeldung hat zu lange gedauert oder ging in einem anderen Tab
        weiter.
      </p>
    </NoticePage>
  )
}
