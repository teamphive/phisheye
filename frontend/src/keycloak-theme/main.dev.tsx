import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { KcPage } from "./kc.gen"
import type { KcContext } from "./login/KcContext"
import { getKcContextMock } from "./login/mocks/getKcContextMock"
import { PreviewBar } from "./PreviewBar"

// `npm run dev-keycloak-theme` renders the theme with mock data instead of the
// app, no Keycloak needed. The bar at the bottom switches pages, or pick one
// with ?page=login-otp.ftl and add &error to see a failed attempt.
const params = new URLSearchParams(window.location.search)
const withError = params.has("error")

const user = "m.sandmann@hansa-logistik.de"

/** Error messages per form field, as Keycloak hands them over. */
function fieldErrors(
  errors: Record<string, string>
): KcContext["messagesPerField"] {
  return {
    printIfExists: (field, text) => (field in errors ? text : undefined),
    existsError: (...fields) => fields.some((field) => field in errors),
    get: (field) => errors[field] ?? "",
    exists: (field) => field in errors,
    getFirstError: (...fields) =>
      fields.map((field) => errors[field]).find(Boolean) ?? "",
  }
}

/** Twelve codes of twelve characters, like Keycloak generates them. */
function recoveryCodes() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return Array.from({ length: 12 }, () =>
    Array.from(
      { length: 12 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("")
  )
}

// As in realm-export.json, except that password reset is already on
const realm = { registrationAllowed: false, rememberMe: false }

// The texts are Keycloak's own German messages, formal "Sie" included.
const mocks: Record<string, { label: string; kcContext: () => KcContext }> = {
  "login.ftl": {
    label: "Login",
    kcContext: () =>
      getKcContextMock({
        pageId: "login.ftl",
        overrides: {
          realm,
          ...(withError && {
            login: { username: user },
            messagesPerField: fieldErrors({
              username: "Ungültiger Benutzername oder Passwort.",
            }),
          }),
        },
      }),
  },
  "login-otp.ftl": {
    label: "2FA",
    kcContext: () =>
      getKcContextMock({
        pageId: "login-otp.ftl",
        overrides: {
          auth: { attemptedUsername: user, showTryAnotherWayLink: true },
          otpLogin: {
            userOtpCredentials: [{ id: "otp-1", userLabel: "iPhone" }],
          },
          ...(withError && {
            messagesPerField: fieldErrors({
              totp: "Ungültiger One-time Code.",
            }),
          }),
        },
      }),
  },
  // "Andere Methode verwenden" on the 2FA page leads here
  "select-authenticator.ftl": {
    label: "Methode wählen",
    kcContext: () =>
      getKcContextMock({
        pageId: "select-authenticator.ftl",
        overrides: {
          auth: {
            attemptedUsername: user,
            authenticationSelections: [
              {
                authExecId: "otp",
                displayName: "otp-display-name",
                helpText: "otp-help-text",
                iconCssClass: "kcAuthenticatorOTPClass",
              },
              {
                authExecId: "recovery-codes",
                displayName: "recovery-authn-codes-display-name",
                helpText: "recovery-authn-codes-help-text",
                iconCssClass: "kcAuthenticatorDefaultClass",
              },
            ],
          },
        },
      }),
  },
  "login-recovery-authn-code-input.ftl": {
    label: "Backup-Code",
    kcContext: () =>
      getKcContextMock({
        pageId: "login-recovery-authn-code-input.ftl",
        overrides: {
          auth: { attemptedUsername: user, showTryAnotherWayLink: true },
          recoveryAuthnCodesInputBean: { codeNumber: 3 },
          ...(withError && {
            messagesPerField: fieldErrors({
              recoveryCodeInput: "Ungültiger Wiederherstellungscode",
            }),
          }),
        },
      }),
  },
  "login-reset-password.ftl": {
    label: "Passwort vergessen",
    kcContext: () =>
      getKcContextMock({
        pageId: "login-reset-password.ftl",
        overrides: {
          realm: { loginWithEmailAllowed: true },
          ...(withError && {
            messagesPerField: fieldErrors({
              username: "Bitte geben Sie einen Benutzernamen ein.",
            }),
          }),
        },
      }),
  },
  // After the reset mail Keycloak goes back to the login page with a notice
  "mail-sent": {
    label: "Mail verschickt",
    kcContext: () =>
      getKcContextMock({
        pageId: "login.ftl",
        overrides: {
          realm,
          message: {
            type: "success",
            summary:
              "Sie sollten in Kürze eine E-Mail mit weiteren Instruktionen erhalten.",
          },
        },
      }),
  },
  "login-update-password.ftl": {
    label: "Neues Passwort",
    kcContext: () =>
      getKcContextMock({
        pageId: "login-update-password.ftl",
        overrides: {
          auth: { attemptedUsername: user },
          ...(withError && {
            messagesPerField: fieldErrors({
              "password-confirm": "Passwörter sind nicht identisch.",
            }),
          }),
        },
      }),
  },
  "login-config-totp.ftl": {
    label: "2FA einrichten",
    kcContext: () =>
      getKcContextMock({
        pageId: "login-config-totp.ftl",
        overrides: withError
          ? {
              messagesPerField: fieldErrors({
                totp: "Ungültiger One-time Code.",
              }),
            }
          : {},
      }),
  },
  "login-recovery-authn-code-config.ftl": {
    label: "Codes sichern",
    kcContext: () => {
      const codes = recoveryCodes()

      return getKcContextMock({
        pageId: "login-recovery-authn-code-config.ftl",
        overrides: {
          auth: { attemptedUsername: user },
          recoveryAuthnCodesConfigBean: {
            generatedRecoveryAuthnCodesList: codes,
            generatedRecoveryAuthnCodesAsString: codes.join(","),
            generatedAt: Date.now(),
          },
        },
      })
    },
  },
}

const pageId = params.get("page") ?? "login.ftl"
const mock = mocks[pageId] ?? mocks["login.ftl"]

// Room below the page, so the preview bar never covers its last button
document.body.style.paddingBottom = "6rem"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KcPage kcContext={mock.kcContext()} />
    <PreviewBar
      pages={Object.fromEntries(
        Object.entries(mocks).map(([id, { label }]) => [id, label])
      )}
      current={pageId}
      withError={withError}
    />
  </StrictMode>
)
