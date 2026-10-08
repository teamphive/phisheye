/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/pages/login-recovery-authn-code-config/Page.tsx" --revert
 */

import { useState } from "react"
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PrinterIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { assert } from "tsafe/assert"

import { AuthCard } from "@/components/auth-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { CancelButton } from "../../components/CancelButton"
import { KcMessage } from "../../components/KcMessage"
import { PageShell } from "../../components/PageShell"
import { useKcContext } from "../../KcContext"

/** 12 characters read easier as three blocks of four. */
function formatCode(code: string) {
  return code.match(/.{1,4}/g)?.join("-") ?? code
}

function download(text: string) {
  const link = document.createElement("a")
  link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
  link.download = "phisheye-backup-codes.txt"
  link.click()
}

function print(text: string) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) return

  // textContent, not markup: nothing of the page ends up in the new window
  const pre = printWindow.document.createElement("pre")
  pre.textContent = text
  printWindow.document.title = "phisheye Backup-Codes"
  printWindow.document.body.append(pre)
  printWindow.print()
  printWindow.close()
}

// Replaces the list, buttons and inline script of the default page. The copy,
// download and print functions work on the same text, so the file on the
// user's disk says the same as the screen.
export function Page() {
  const { kcContext } = useKcContext()
  assert(kcContext.pageId === "login-recovery-authn-code-config.ftl")

  const { recoveryAuthnCodesConfigBean, url, auth, isAppInitiatedAction } =
    kcContext
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const codes =
    recoveryAuthnCodesConfigBean.generatedRecoveryAuthnCodesList.map(formatCode)
  const createdAt = new Date(
    recoveryAuthnCodesConfigBean.generatedAt
  ).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })

  // Keycloak asks for one code by its number, so the numbers go along
  const text = [
    `phisheye · Backup-Codes${auth?.attemptedUsername ? ` für ${auth.attemptedUsername}` : ""}`,
    "",
    ...codes.map((code, index) => `${index + 1}: ${code}`),
    "",
    "Jeder Code funktioniert nur einmal. Bei der Anmeldung wird nach einer bestimmten Nummer gefragt.",
    `Erstellt am ${createdAt}`,
  ].join("\n")

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // No clipboard outside HTTPS; download and print still work
      return
    }
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <PageShell title="Backup-Codes">
      <AuthCard width={560}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isAppInitiatedAction
              ? "Neue Backup-Codes"
              : "Backup-Codes sichern"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isAppInitiatedAction
              ? "Die neuen Codes ersetzen alle bisherigen."
              : "Ohne Authenticator-App kommst du mit einem dieser Codes in dein Konto. Jeder Code funktioniert nur einmal."}
          </p>
        </div>

        <KcMessage />

        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Die Codes erscheinen nur jetzt</AlertTitle>
          <AlertDescription>
            Nach dieser Seite lassen sie sich nicht mehr anzeigen, auch nicht
            von einem Admin.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Deine Codes</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Erstellt am {createdAt}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="gap-x-4 sm:columns-2">
              {codes.map((code, index) => (
                <li
                  key={code}
                  className="mb-1.5 flex break-inside-avoid gap-2 rounded bg-muted px-2 py-1 font-mono text-xs tracking-wider whitespace-nowrap"
                >
                  <span className="w-5 text-right text-faint">{index + 1}</span>
                  {code}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => download(text)}
              >
                <DownloadIcon />
                Herunterladen
              </Button>
              <Button variant="outline" size="sm" onClick={copy}>
                {isCopied ? <CheckIcon /> : <CopyIcon />}
                {isCopied ? "Kopiert" : "Kopieren"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => print(text)}>
                <PrinterIcon />
                Drucken
              </Button>
            </div>
          </CardContent>
        </Card>

        <Label className="gap-2 text-sm font-normal">
          <Checkbox
            checked={isConfirmed}
            onCheckedChange={(checked) => setIsConfirmed(checked)}
          />
          Ich habe die Codes an einem sicheren Ort gespeichert.
        </Label>

        <form
          action={url.loginAction}
          method="post"
          className="flex flex-col gap-2.5"
          onSubmit={() => setIsSubmitting(true)}
        >
          <input
            type="hidden"
            name="generatedRecoveryAuthnCodes"
            value={
              recoveryAuthnCodesConfigBean.generatedRecoveryAuthnCodesAsString
            }
          />
          <input
            type="hidden"
            name="generatedAt"
            value={recoveryAuthnCodesConfigBean.generatedAt}
          />
          {/* Name of the credential in Keycloak's account console */}
          <input type="hidden" name="userLabel" value="Backup-Codes" />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!isConfirmed || isSubmitting}
          >
            {isSubmitting && <Spinner />}
            {isAppInitiatedAction
              ? "Neue Codes übernehmen"
              : "Einrichtung abschließen"}
          </Button>
          <CancelButton />
        </form>
      </AuthCard>
    </PageShell>
  )
}
