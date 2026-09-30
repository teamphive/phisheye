/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-verify-email/Page.tsx" --revert
 */

import { MailIcon } from "lucide-react"
import { assert } from "tsafe/assert"

import { buttonVariants } from "@/components/ui/button"
import { NoticePage } from "../../components/NoticePage"
import { RestartLogin } from "../../components/RestartLogin"
import { useKcContext } from "../../KcContext"

// Keycloak has sent the mail already. Opening this page's form address again
// sends a new one.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-verify-email.ftl")

  const { url, user } = kcContext

  return (
    <NoticePage
      title="E-Mail-Adresse bestätigen"
      heading="E-Mail-Adresse bestätigen"
      tone="info"
      icon={MailIcon}
      actions={
        <>
          <a
            href={url.loginAction}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "w-full",
            })}
          >
            Mail erneut senden
          </a>
          <RestartLogin />
        </>
      }
    >
      <p>
        Wir haben eine Mail
        {user?.email ? (
          <>
            {" "}
            an <span className="font-medium text-foreground">{user.email}</span>
          </>
        ) : null}{" "}
        geschickt. Öffne den Link darin, um weiterzumachen.
      </p>
    </NoticePage>
  )
}
