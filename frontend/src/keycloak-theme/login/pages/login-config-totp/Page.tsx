/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-config-totp/Page.tsx" --revert
 */

import { useState } from "react"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { assert } from "tsafe/assert"

import { AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { CancelButton } from "../../components/CancelButton"
import { KcFieldError } from "../../components/KcFieldError"
import { KcMessage } from "../../components/KcMessage"
import { PageShell } from "../../components/PageShell"
import { useI18n } from "../../i18n"
import { useKcContext } from "../../KcContext"

// QR code and key are on the same page, so Keycloak's separate manual mode
// (?mode=manual) needs no view of its own. Backup codes are a required action
// of their own and come after this page once the realm turns them on.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-config-totp.ftl")

  const { totp, url, messagesPerField, isAppInitiatedAction } = kcContext
  const { advancedMsgStr } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasError = messagesPerField.existsError("totp", "userLabel")
  // Keycloak insists on a name as soon as there are devices to tell apart
  const isLabelRequired = totp.otpCredentials.length >= 1
  const apps = new Intl.ListFormat("de", { type: "disjunction" }).format(
    totp.supportedApplications.map((app) => advancedMsgStr(app))
  )

  return (
    <PageShell title="2FA einrichten">
      <AuthCard width={560}>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Zwei-Faktor-Authentifizierung einrichten
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isAppInitiatedAction
              ? "Ein weiteres Gerät für die Anmeldung hinzufügen."
              : "Pflicht für alle Team-Mitglieder."}
          </p>
        </div>

        {!hasError && <KcMessage />}

        <Card>
          <CardContent className="flex flex-col items-start gap-5 sm:flex-row">
            <img
              src={`data:image/png;base64,${totp.totpSecretQrCode}`}
              alt="QR-Code für die Authenticator-App"
              className="size-[148px] shrink-0 rounded-md border border-border bg-white p-2"
            />
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <div className="text-[13.5px] font-semibold">
                  1. QR-Code scannen
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mit einer Authenticator-App deiner Wahl, zum Beispiel {apps}.
                </p>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  Falls das Scannen nicht klappt:
                </div>
                <code className="block rounded-md border border-border bg-muted px-3 py-2 font-mono text-[11.5px] break-all text-muted-foreground">
                  {totp.totpSecretEncoded}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-[18px]"
          onSubmit={() => setIsSubmitting(true)}
        >
          <input type="hidden" name="totpSecret" value={totp.totpSecret} />

          <div className="grid gap-2">
            <Label htmlFor="totp">2. Code aus der App eingeben</Label>
            <InputOTP
              id="totp"
              name="totp"
              maxLength={totp.policy.digits}
              pattern={REGEXP_ONLY_DIGITS}
              autoComplete="one-time-code"
              aria-invalid={messagesPerField.existsError("totp") || undefined}
              autoFocus
            >
              <InputOTPGroup>
                {Array.from({ length: totp.policy.digits }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={
                      messagesPerField.existsError("totp") || undefined
                    }
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {messagesPerField.existsError("totp") && (
              <KcFieldError message={messagesPerField.get("totp")} />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="userLabel">
              3. Gerät benennen
              {!isLabelRequired && (
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              )}
            </Label>
            <Input
              id="userLabel"
              name="userLabel"
              placeholder="z. B. iPhone"
              autoComplete="off"
              required={isLabelRequired}
              aria-invalid={
                messagesPerField.existsError("userLabel") || undefined
              }
            />
            {messagesPerField.existsError("userLabel") && (
              <KcFieldError message={messagesPerField.get("userLabel")} />
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting && <Spinner />}
              Einrichtung abschließen
            </Button>
            <CancelButton />
          </div>
        </form>
      </AuthCard>
    </PageShell>
  )
}
