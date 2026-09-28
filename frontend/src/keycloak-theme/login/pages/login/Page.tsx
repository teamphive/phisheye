/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login/Page.tsx" --revert
 */

import { useState } from "react"
import { assert } from "tsafe/assert"

import { AuthSplit, LoginAside } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { KcFieldError } from "../../components/KcFieldError"
import { KcMessage } from "../../components/KcMessage"
import { PageShell } from "../../components/PageShell"
import { useKcContext } from "../../KcContext"

// Passkeys and social login are off in the realm, so this page leaves out
// what the default login.ftl renders for them.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login.ftl")

  const { realm, url, login, auth, messagesPerField, usernameHidden } =
    kcContext
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Keycloak answers a wrong username and a wrong password with the same
  // message, so it belongs to both fields and shows up once below them.
  const hasError = messagesPerField.existsError("username", "password")

  const usernameLabel = !realm.loginWithEmailAllowed
    ? "Benutzername"
    : realm.registrationEmailAsUsername
      ? "E-Mail-Adresse"
      : "E-Mail-Adresse oder Benutzername"

  return (
    <PageShell title="Anmelden">
      <AuthSplit aside={<LoginAside />}>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Anmelden</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Mit deinem Firmenkonto
          </p>
        </div>

        {!hasError && <KcMessage />}

        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-[18px]"
          onSubmit={() => setIsSubmitting(true)}
        >
          {usernameHidden ? (
            <p className="text-sm text-muted-foreground">
              Angemeldet als{" "}
              <span className="font-medium text-foreground">
                {auth.attemptedUsername}
              </span>{" "}
              ·{" "}
              <a
                href={url.loginRestartFlowUrl}
                className="text-primary hover:underline"
              >
                anderes Konto
              </a>
            </p>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="username">{usernameLabel}</Label>
              <Input
                id="username"
                name="username"
                type={
                  realm.loginWithEmailAllowed &&
                  realm.registrationEmailAsUsername
                    ? "email"
                    : "text"
                }
                autoComplete="username"
                defaultValue={login.username ?? ""}
                aria-invalid={hasError || undefined}
                autoFocus
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={hasError || undefined}
              autoFocus={usernameHidden}
            />
            {hasError && (
              <KcFieldError
                message={messagesPerField.getFirstError("username", "password")}
              />
            )}
          </div>

          {(realm.rememberMe || realm.resetPasswordAllowed) && (
            <div className="flex items-center justify-between">
              {realm.rememberMe && !usernameHidden ? (
                <Label className="gap-2 text-xs font-normal text-muted-foreground">
                  {/* Keycloak only honours the value "on" */}
                  <Checkbox
                    name="rememberMe"
                    value="on"
                    defaultChecked={login.rememberMe === "on"}
                  />
                  Angemeldet bleiben
                </Label>
              ) : (
                <span />
              )}
              {realm.resetPasswordAllowed && (
                <a
                  href={url.loginResetCredentialsUrl}
                  className="text-xs text-primary hover:underline"
                >
                  Passwort vergessen?
                </a>
              )}
            </div>
          )}

          <input
            type="hidden"
            name="credentialId"
            value={auth.selectedCredential ?? ""}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && <Spinner />}
            Anmelden
          </Button>
        </form>

        <Separator />

        {realm.registrationAllowed && !kcContext.registrationDisabled ? (
          <p className="text-center text-xs text-muted-foreground">
            Noch kein Konto?{" "}
            <a
              href={url.registrationUrl}
              className="text-primary hover:underline"
            >
              Registrieren
            </a>
          </p>
        ) : (
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Konten werden ausschließlich von einem Admin deines Unternehmens
            angelegt.
            <br />
            Eine Selbstregistrierung gibt es nicht.
          </p>
        )}
      </AuthSplit>
    </PageShell>
  )
}
