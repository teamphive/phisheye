// Keycloak serves the same bundle for its login pages and puts
// window.kcContext on them, so one entry point starts either the theme or the
// app. VITE_KC_DEV shows the theme with mock data, see README.
if (window.kcContext !== undefined) {
  import("./keycloak-theme/main")
} else if (import.meta.env.VITE_KC_DEV === "true") {
  import("./keycloak-theme/main.dev")
} else {
  import("./main-app")
}
