/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-reset-password/Page.tsx" --revert
 */

import { useState } from "react"
import { assert } from "tsafe/assert"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { KcFieldError } from "../../components/KcFieldError"
import { KcMessage } from "../../components/KcMessage"
import { PageShell } from "../../components/PageShell"
import { useKcContext } from "../../KcContext"
import { usernameField } from "../../usernameField"

// After sending the mail Keycloak returns to the login page and shows its
// confirmation there, so this page has no "sent" state of its own.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-reset-password.ftl")

  const { realm, url, auth, messagesPerField } = kcContext
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasError = messagesPerField.existsError("username")
  const username = usernameField(realm)

  return (
    <PageShell title="Passwort vergessen">
      <AuthCard>
        <AuthBrand centered />

        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Passwort vergessen
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Wir schicken dir einen Link, mit dem du ein neues Passwort setzen
            kannst.
          </p>
        </div>

        {!hasError && <KcMessage />}

        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-[18px]"
          onSubmit={() => setIsSubmitting(true)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="username">{username.label}</Label>
            <Input
              id="username"
              name="username"
              type={username.type}
              autoComplete="username"
              defaultValue={auth.attemptedUsername ?? ""}
              aria-invalid={hasError || undefined}
              autoFocus
            />
            {hasError && (
              <KcFieldError message={messagesPerField.get("username")} />
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && <Spinner />}
            Link anfordern
          </Button>
        </form>

        <p className="text-center">
          <a
            href={url.loginUrl}
            className="text-xs text-primary hover:underline"
          >
            Zurück zur Anmeldung
          </a>
        </p>
      </AuthCard>
    </PageShell>
  )
}
