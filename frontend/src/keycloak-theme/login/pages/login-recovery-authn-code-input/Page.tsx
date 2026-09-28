/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-recovery-authn-code-input/Page.tsx" --revert
 */

import { useState } from "react"
import { assert } from "tsafe/assert"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { KcFieldError } from "../../components/KcFieldError"
import { KcMessage } from "../../components/KcMessage"
import { PageShell } from "../../components/PageShell"
import { RestartLogin } from "../../components/RestartLogin"
import { TryAnotherWay } from "../../components/TryAnotherWay"
import { useKcContext } from "../../KcContext"

export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-recovery-authn-code-input.ftl")

  const { url, messagesPerField, recoveryAuthnCodesInputBean } = kcContext
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasError = messagesPerField.existsError("recoveryCodeInput")
  const { codeNumber } = recoveryAuthnCodesInputBean

  return (
    <PageShell title="Backup-Code">
      <AuthCard>
        <AuthBrand centered />

        <div className="text-center">
          <h1 className="text-[21px] font-semibold tracking-tight">
            Backup-Code eingeben
          </h1>
          {/* Keycloak uses the codes in order and checks only this one */}
          <p className="mt-1.5 text-sm text-muted-foreground">
            Code Nr. {codeNumber} aus der Liste, die du bei der Einrichtung
            gesichert hast. Jeder Code funktioniert nur einmal.
          </p>
        </div>

        {!hasError && <KcMessage />}

        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-[18px]"
          onSubmit={(event) => {
            // The list shows the codes in blocks of four, Keycloak stored
            // them without the dashes
            const input =
              event.currentTarget.elements.namedItem("recoveryCodeInput")
            if (input instanceof HTMLInputElement) {
              input.value = input.value.replace(/[\s-]/g, "")
            }
            setIsSubmitting(true)
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="recoveryCodeInput">
              Backup-Code Nr. {codeNumber}
            </Label>
            <Input
              id="recoveryCodeInput"
              name="recoveryCodeInput"
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              className="text-center font-mono tracking-widest"
              aria-invalid={hasError || undefined}
              autoFocus
            />
            {hasError && (
              <KcFieldError
                message={messagesPerField.get("recoveryCodeInput")}
              />
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && <Spinner />}
            Bestätigen
          </Button>
        </form>

        <TryAnotherWay />

        <Separator />

        <RestartLogin />
      </AuthCard>
    </PageShell>
  )
}
