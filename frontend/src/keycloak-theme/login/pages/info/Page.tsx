/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/info/Page.tsx" --revert
 */

import { kcSanitize } from "@keycloakify/login-ui/kcSanitize"
import { assert } from "tsafe/assert"

import { buttonVariants } from "@/components/ui/button"
import { NoticePage, type NoticeTone } from "../../components/NoticePage"
import { useI18n } from "../../i18n"
import { useKcContext } from "../../KcContext"

// Keycloak names the steps formally and at length, these are the ones an
// invited person meets.
const actionLabels: Record<string, string> = {
  UPDATE_PASSWORD: "Passwort setzen",
  UPDATE_PROFILE: "Profil vervollständigen",
  CONFIGURE_TOTP: "Zwei-Faktor-Authentifizierung einrichten",
  CONFIGURE_RECOVERY_AUTHN_CODES: "Backup-Codes sichern",
  VERIFY_EMAIL: "E-Mail-Adresse bestätigen",
}

const link = buttonVariants({ size: "lg", className: "w-full" })

// Comes after the link in Keycloak's setup mail, before the steps it asks for,
// and again once they are done. Other notes of Keycloak pass through as they
// are.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "info.ftl")

  const { advancedMsgStr } = useI18n()
  const {
    message,
    messageHeader,
    requiredActions,
    skipLink,
    pageRedirectUri,
    actionUri,
    client,
  } = kcContext

  // In the order Keycloak itself picks the way on
  const next = skipLink
    ? null
    : pageRedirectUri
      ? { href: pageRedirectUri, label: "Zu phisheye" }
      : actionUri
        ? { href: actionUri, label: "Weiter" }
        : client.baseUrl
          ? { href: client.baseUrl, label: "Zu phisheye" }
          : null

  const actions = next ? (
    <a href={next.href} className={link}>
      {next.label}
    </a>
  ) : null

  if (requiredActions?.length) {
    return (
      <NoticePage
        title="Konto einrichten"
        heading="Konto einrichten"
        tone="info"
        actions={actions}
      >
        <p>Für dein phisheye-Konto fehlen noch diese Schritte:</p>
        <ol className="mt-3 flex flex-col gap-1.5 text-left">
          {requiredActions.map((action, index) => (
            <li
              key={action}
              className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-foreground"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded bg-secondary font-mono text-[10px] font-semibold text-faint">
                {index + 1}
              </span>
              {actionLabels[action] ??
                advancedMsgStr(`requiredAction.${action}`)}
            </li>
          ))}
        </ol>
      </NoticePage>
    )
  }

  const tone: NoticeTone = message.type
  const heading = messageHeader
    ? advancedMsgStr(messageHeader)
    : tone === "success"
      ? "Erledigt"
      : "Hinweis"

  return (
    <NoticePage title={heading} heading={heading} tone={tone} actions={actions}>
      <p dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
    </NoticePage>
  )
}
