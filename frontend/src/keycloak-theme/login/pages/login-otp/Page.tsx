/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-otp/Page.tsx" --revert
 */

import { useRef, useState } from "react"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { assert } from "tsafe/assert"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { KcFieldError } from "../../components/KcFieldError"
import { KcMessage } from "../../components/KcMessage"
import { PageShell } from "../../components/PageShell"
import { RestartLogin } from "../../components/RestartLogin"
import { TryAnotherWay } from "../../components/TryAnotherWay"
import { useKcContext } from "../../KcContext"

// Keycloak's default for otpPolicyDigits, the realm does not change it.
const CODE_LENGTH = 6

export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-otp.ftl")

  const { otpLogin, url, messagesPerField } = kcContext
  const formRef = useRef<HTMLFormElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasError = messagesPerField.existsError("totp")

  return (
    <PageShell title="Bestätigungscode">
      <AuthCard>
        <AuthBrand centered />

        <div className="text-center">
          <h1 className="text-[21px] font-semibold tracking-tight">
            Bestätigungscode eingeben
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sechsstelliger Code aus deiner Authenticator-App
          </p>
        </div>

        {!hasError && <KcMessage />}

        <form
          ref={formRef}
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-[18px]"
          onSubmit={() => setIsSubmitting(true)}
        >
          {otpLogin.userOtpCredentials.length > 1 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-medium">Gerät</legend>
              {otpLogin.userOtpCredentials.map((credential) => (
                <label
                  key={credential.id}
                  className="flex items-center gap-2.5 rounded-lg border border-input px-3 py-2 text-sm has-checked:border-primary"
                >
                  <input
                    type="radio"
                    name="selectedCredentialId"
                    value={credential.id}
                    defaultChecked={
                      credential.id === otpLogin.selectedCredentialId
                    }
                    className="accent-primary"
                  />
                  {credential.userLabel}
                </label>
              ))}
            </fieldset>
          )}

          <div className="flex flex-col items-center gap-2">
            <InputOTP
              name="otp"
              maxLength={CODE_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              autoComplete="one-time-code"
              aria-label="Bestätigungscode"
              aria-invalid={hasError || undefined}
              autoFocus
              // The last digit sends the form, as most authenticators expect.
              onComplete={() => {
                if (!isSubmitting) formRef.current?.requestSubmit()
              }}
            >
              <InputOTPGroup>
                {Array.from({ length: CODE_LENGTH }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={hasError || undefined}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {hasError && (
              <KcFieldError
                message={messagesPerField.get("totp")}
                className="text-center"
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
