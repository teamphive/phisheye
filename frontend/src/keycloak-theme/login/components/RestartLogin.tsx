import { useKcContext } from "../KcContext"

/** Who is signing in, and the way back to a fresh login. */
export function RestartLogin() {
  const { kcContext } = useKcContext()
  const { auth, url } = kcContext

  return (
    <p className="text-center text-xs text-faint">
      {auth?.attemptedUsername && (
        <>Angemeldet als {auth.attemptedUsername} · </>
      )}
      <a href={url.loginRestartFlowUrl} className="hover:underline">
        abbrechen
      </a>
    </p>
  )
}
