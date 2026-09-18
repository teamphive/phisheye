import Keycloak from "keycloak-js"

// Public values, see .env.example: a browser client has no secret, PKCE
// protects the flow. keycloak-js keeps the tokens in memory only, nothing of
// them reaches local or session storage.
const url = import.meta.env.VITE_KEYCLOAK_URL
const realm = import.meta.env.VITE_KEYCLOAK_REALM
const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID

/**
 * Without a configured server the app starts without a login, so the interface
 * stays usable while Keycloak is not running. Nothing is given up by that: the
 * API is protected because the backend verifies the token, never because the
 * browser asked for one.
 */
export const authEnabled = Boolean(url && realm && clientId)

/** Only for the error message, so a wrong address is visible at a glance. */
export const keycloakUrl = url ?? ""

export const keycloak = new Keycloak({
  url: url ?? "",
  realm: realm ?? "",
  clientId: clientId ?? "",
})

/**
 * keycloak-js sends the browser straight to the login page without ever asking
 * whether the server answers, so a stopped Keycloak would end in the browser's
 * own error page. One request beforehand keeps that inside the app. The answer
 * cannot be read across origins, but a rejected request is the signal wanted:
 * nothing is listening.
 */
async function ensureReachable() {
  await fetch(`${url}/realms/${realm}/.well-known/openid-configuration`, {
    mode: "no-cors",
    signal: AbortSignal.timeout(5000),
  })
}

async function start() {
  if (!authEnabled) return false

  await ensureReachable()

  return keycloak.init({
    onLoad: "login-required",
    pkceMethod: "S256",
    // The session iframe polls Keycloak from a hidden frame, which browsers
    // block as soon as third party cookies are off. A token lives five
    // minutes, so a logout elsewhere is noticed soon enough without it.
    checkLoginIframe: false,
  })
}

let running: Promise<boolean> | undefined

/**
 * Sends the browser to the login page and comes back with a token. Runs once
 * per page load: React calls effects twice in development and Keycloak refuses
 * a second init, so the first promise is handed out again.
 */
export function initAuth(): Promise<boolean> {
  running ??= start()

  return running
}

/** Ends the Keycloak session, not only the one in this tab. */
export function logout() {
  return keycloak.logout({ redirectUri: window.location.origin })
}

/** Opens the Keycloak account console: password, second factor, devices. */
export function openAccount() {
  return keycloak.accountManagement()
}

/** Back to the login page after the session is gone. */
export function login() {
  return keycloak.login()
}
