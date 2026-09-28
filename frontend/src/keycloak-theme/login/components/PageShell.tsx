import { useEffect, type ReactNode } from "react"
import { useInsertScriptTags } from "@keycloakify/login-ui/tools/useInsertScriptTags"

import "@/index.css"
import { ThemeProvider } from "@/components/theme-provider"
import { BASE_URL } from "../../kc.gen"
import { useKcContext } from "../KcContext"

/**
 * Frame for every page drawn in the phisheye design. It takes the place of the
 * Template from @keycloakify/login-ui, which would load the PatternFly styles
 * of the default Keycloak pages. Pages still on the Template keep them.
 */
export function PageShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const { kcContext } = useKcContext()

  useEffect(() => {
    document.title = `${title} · phisheye`
  }, [title])

  // The same scripts the Template loads: a login finished in another tab
  // moves this one on as well, instead of leaving a stale form behind.
  const { insertScriptTags } = useInsertScriptTags({
    effectId: "PageShell",
    scriptTags: [
      ...(kcContext.scripts ?? []).map((src) => ({
        type: "text/javascript" as const,
        src,
      })),
      {
        type: "module",
        textContent: [
          `import { startSessionPolling, checkAuthSession } from "${BASE_URL}keycloak-theme/login/js/authChecker.js";`,
          `startSessionPolling("${kcContext.url.ssoLoginInOtherTabsUrl}");`,
          kcContext.authenticationSession === undefined
            ? ""
            : `checkAuthSession("${kcContext.authenticationSession.authSessionIdHash}");`,
        ].join("\n"),
      },
    ],
  })

  // authChecker.js looks for the forms once it runs, so it has to come after
  // the first render.
  useEffect(() => {
    insertScriptTags()
  }, [insertScriptTags])

  return <ThemeProvider>{children}</ThemeProvider>
}
