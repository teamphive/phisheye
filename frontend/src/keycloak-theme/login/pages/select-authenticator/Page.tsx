/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/select-authenticator/Page.tsx" --revert
 */

import {
  ChevronRightIcon,
  FingerprintIcon,
  KeyRoundIcon,
  ListOrderedIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  type LucideIcon,
} from "lucide-react"
import { assert } from "tsafe/assert"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Separator } from "@/components/ui/separator"
import { KcMessage } from "../../components/KcMessage"
import { PageShell } from "../../components/PageShell"
import { RestartLogin } from "../../components/RestartLogin"
import { useI18n } from "../../i18n"
import { useKcContext } from "../../KcContext"

type Method = { icon: LucideIcon; name: string; help: string }

// Keycloak names each method by a message key. The realm has no German locale
// yet, so the known ones get their text here, anything else falls back to
// Keycloak's translation.
const methods: { match: string; method: Method }[] = [
  {
    match: "otp",
    method: {
      icon: SmartphoneIcon,
      name: "Authenticator-App",
      help: "Sechsstelliger Code aus der App auf deinem Handy",
    },
  },
  {
    match: "recovery",
    method: {
      icon: ListOrderedIcon,
      name: "Backup-Code",
      help: "Einer der Codes, die du bei der Einrichtung gesichert hast",
    },
  },
  {
    match: "webauthn",
    method: {
      icon: FingerprintIcon,
      name: "Passkey",
      help: "Fingerabdruck, Gesicht oder Sicherheitsschlüssel",
    },
  },
  {
    match: "password",
    method: {
      icon: KeyRoundIcon,
      name: "Passwort",
      help: "Das Passwort deines Kontos",
    },
  },
]

export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "select-authenticator.ftl")

  const { url, auth } = kcContext
  const { advancedMsgStr } = useI18n()

  function describe(displayName: string, helpText: string): Method {
    return (
      methods.find(({ match }) => displayName.includes(match))?.method ?? {
        icon: ShieldCheckIcon,
        name: advancedMsgStr(displayName),
        help: advancedMsgStr(helpText),
      }
    )
  }

  return (
    <PageShell title="Methode wählen">
      <AuthCard>
        <AuthBrand centered />

        <div className="text-center">
          <h1 className="text-[21px] font-semibold tracking-tight">
            Anmeldung bestätigen
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Womit möchtest du dich ausweisen?
          </p>
        </div>

        <KcMessage />

        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-2"
        >
          {auth.authenticationSelections.map((selection) => {
            const {
              icon: Icon,
              name,
              help,
            } = describe(selection.displayName, selection.helpText)

            return (
              <button
                key={selection.authExecId}
                type="submit"
                name="authenticationExecution"
                value={selection.authExecId}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-colors outline-none hover:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-primary">
                  <Icon className="size-[18px]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">{help}</span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-faint" />
              </button>
            )
          })}
        </form>

        <Separator />

        <RestartLogin />
      </AuthCard>
    </PageShell>
  )
}
