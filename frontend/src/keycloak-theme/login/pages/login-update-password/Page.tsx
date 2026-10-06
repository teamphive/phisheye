/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-update-password/Page.tsx" --revert
 */

import { useState } from "react"
import { assert } from "tsafe/assert"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { CancelButton } from "../../components/CancelButton"
import { KcFieldError } from "../../components/KcFieldError"
import { KcMessage } from "../../components/KcMessage"
import { PageShell } from "../../components/PageShell"
import { useKcContext } from "../../KcContext"

// Shown after the link from the reset mail and for the first password of an
// account an admin created. The realm has no password policy yet, so the page
// promises no rules; Keycloak's error names the one that failed.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-update-password.ftl")

  const { url, auth, messagesPerField } = kcContext
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasError = messagesPerField.existsError("password", "password-confirm")

  return (
    <PageShell title="Neues Passwort">
      <AuthCard>
        <AuthBrand centered />

        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Neues Passwort setzen
          </h1>
          {auth?.attemptedUsername && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Für {auth.attemptedUsername}
            </p>
          )}
        </div>

        {!hasError && <KcMessage />}

        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-[18px]"
          onSubmit={() => setIsSubmitting(true)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="password-new">Neues Passwort</Label>
            <Input
              id="password-new"
              name="password-new"
              type="password"
              autoComplete="new-password"
              aria-invalid={hasError || undefined}
              autoFocus
            />
            {messagesPerField.existsError("password") && (
              <KcFieldError message={messagesPerField.get("password")} />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="password-confirm">Passwort wiederholen</Label>
            <Input
              id="password-confirm"
              name="password-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={hasError || undefined}
            />
            {messagesPerField.existsError("password-confirm") && (
              <KcFieldError
                message={messagesPerField.get("password-confirm")}
              />
            )}
          </div>

          {/* Whoever lost the password may not be the only one who knows it */}
          <input type="hidden" name="logout-sessions" value="on" />

          <div className="flex flex-col gap-2.5">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting && <Spinner />}
              Passwort speichern
            </Button>
            <CancelButton />
          </div>
        </form>

        <p className="text-center text-xs text-faint">
          Nach dem Speichern wirst du auf allen anderen Geräten abgemeldet.
        </p>
      </AuthCard>
    </PageShell>
  )
}
