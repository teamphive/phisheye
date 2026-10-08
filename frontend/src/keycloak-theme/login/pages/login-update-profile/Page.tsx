/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-update-profile/Page.tsx" --revert
 */

import { useState } from "react"
import type { Attribute } from "@keycloakify/login-ui/KcContext"
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
import { useI18n } from "../../i18n"
import { useKcContext } from "../../KcContext"

// The realm keeps Keycloak's default profile. Any other attribute still gets a
// text field under the name Keycloak gives it.
const labels: Record<string, string> = {
  username: "Benutzername",
  email: "E-Mail-Adresse",
  firstName: "Vorname",
  lastName: "Nachname",
}

const autoComplete: Record<string, Attribute["autocomplete"]> = {
  username: "username",
  email: "email",
  firstName: "given-name",
  lastName: "family-name",
}

// Part of the setup after an invitation. First and last name become the name
// the team sees in phisheye.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-update-profile.ftl")

  const { advancedMsgStr } = useI18n()
  const { url, profile, messagesPerField } = kcContext
  const [isSubmitting, setIsSubmitting] = useState(false)

  const attributes = Object.values(profile.attributesByName)
  const hasError = attributes.some((attribute) =>
    messagesPerField.existsError(attribute.name)
  )
  const firstEditable = attributes.find((attribute) => !attribute.readOnly)

  return (
    <PageShell title="Profil">
      <AuthCard>
        <AuthBrand centered />

        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Profil vervollständigen
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Unter diesem Namen sieht dich dein Team in phisheye.
          </p>
        </div>

        {!hasError && <KcMessage />}

        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-[18px]"
          onSubmit={() => setIsSubmitting(true)}
        >
          {attributes.map((attribute) => {
            const error = messagesPerField.existsError(attribute.name)

            return (
              <div key={attribute.name} className="grid gap-1.5">
                <Label htmlFor={attribute.name}>
                  {labels[attribute.name] ??
                    advancedMsgStr(attribute.displayName ?? attribute.name)}
                </Label>
                <Input
                  id={attribute.name}
                  name={attribute.name}
                  type={attribute.name === "email" ? "email" : "text"}
                  defaultValue={attribute.value ?? ""}
                  readOnly={attribute.readOnly}
                  required={attribute.required}
                  autoComplete={
                    attribute.autocomplete ?? autoComplete[attribute.name]
                  }
                  className={
                    attribute.readOnly ? "text-muted-foreground" : undefined
                  }
                  aria-invalid={error || undefined}
                  autoFocus={attribute === firstEditable}
                />
                {error && (
                  <KcFieldError
                    message={messagesPerField.get(attribute.name)}
                  />
                )}
              </div>
            )
          })}

          <div className="flex flex-col gap-2.5">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting && <Spinner />}
              Speichern
            </Button>
            <CancelButton />
          </div>
        </form>
      </AuthCard>
    </PageShell>
  )
}
