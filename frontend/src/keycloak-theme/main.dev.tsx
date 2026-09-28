import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { KcPage } from "./kc.gen"
import type { KcContext } from "./login/KcContext"
import { getKcContextMock } from "./login/mocks/getKcContextMock"

// `npm run dev-keycloak-theme` renders the theme with mock data instead of the
// app, no Keycloak needed. Pick the page with ?page=login-otp.ftl and add
// ?error to see a failed attempt, e.g. /?page=login.ftl&error
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

const mocks = {
  "login.ftl": () =>
    getKcContextMock({
      pageId: "login.ftl",
      overrides: {
        // As in realm-export.json, except that password reset is already on
        realm: { registrationAllowed: false, rememberMe: false },
        ...(withError && {
          login: { username: user },
          messagesPerField: fieldErrors({
            username: "Ungültiger Benutzername oder Passwort.",
          }),
        }),
      },
    }),
  "login-otp.ftl": () =>
    getKcContextMock({
      pageId: "login-otp.ftl",
      overrides: {
        auth: { attemptedUsername: user, showTryAnotherWayLink: true },
        otpLogin: {
          userOtpCredentials: [{ id: "otp-1", userLabel: "iPhone" }],
        },
        ...(withError && {
          messagesPerField: fieldErrors({ totp: "Ungültiger Einmalcode." }),
        }),
      },
    }),
}

const pageId = params.get("page") ?? "login.ftl"
const kcContext = (mocks[pageId as keyof typeof mocks] ?? mocks["login.ftl"])()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KcPage kcContext={kcContext} />
  </StrictMode>
)
