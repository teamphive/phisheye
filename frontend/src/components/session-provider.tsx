/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Navigate } from "react-router"
import { TriangleAlertIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { CreateTeamDialog } from "@/components/create-team-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { errorMessage, SessionExpiredError } from "@/lib/api"
import { authEnabled, logout } from "@/lib/keycloak"
import { permissionsOf, type Permissions } from "@/lib/permissions"
import { fetchSession, selectTeam, type Session } from "@/lib/session"
import type { CurrentUser, Team } from "@/mocks/session"

type SessionState = {
  user: CurrentUser
  teams: Team[]
  activeTeam: Team
  permissions: Permissions
  /** The team being switched to while the request runs, otherwise null. */
  pendingTeamId: string | null
  switchTeam: (teamId: string) => Promise<void>
  /**
   * Asks the server again, after anything that changes teams, names or the
   * own role, and resolves with its answer. Throws instead of replacing the
   * app with an error screen.
   */
  refresh: () => Promise<Session>
}

const SessionContext = React.createContext<SessionState | undefined>(undefined)

/**
 * Loads the signed in user and the teams before anything of the app renders,
 * so every page can rely on an active team and the role in it. The interface
 * only follows a team switch once the server has accepted it, so it never
 * shows a team whose data the API would not hand out.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [error, setError] = React.useState<unknown>(null)
  const [attempt, setAttempt] = React.useState(0)
  const [pendingTeamId, setPendingTeamId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    fetchSession().then(
      (loaded) => {
        if (active) setSession(loaded)
      },
      (loadError: unknown) => {
        if (active) setError(loadError)
      }
    )

    return () => {
      active = false
    }
    // Once per mount and again on retry, never per page change.
  }, [attempt])

  const activeTeamId = session?.activeTeamId ?? null

  const switchTeam = React.useCallback(
    async (teamId: string) => {
      if (teamId === activeTeamId) return

      setPendingTeamId(teamId)

      try {
        await selectTeam(teamId)
        setSession((current) => current && { ...current, activeTeamId: teamId })
      } finally {
        setPendingTeamId(null)
      }
    },
    [activeTeamId]
  )

  const refresh = React.useCallback(async () => {
    const loaded = await fetchSession()
    setSession(loaded)
    return loaded
  }, [])

  const value = React.useMemo(() => {
    const activeTeam = session?.teams.find((team) => team.id === activeTeamId)
    if (!session || !activeTeam) return undefined

    return {
      user: session.user,
      teams: session.teams,
      activeTeam,
      permissions: permissionsOf(activeTeam.role, session.user),
      pendingTeamId,
      switchTeam,
      refresh,
    }
  }, [session, activeTeamId, pendingTeamId, switchTeam, refresh])

  if (error instanceof SessionExpiredError) {
    return <Navigate to="/sitzung-abgelaufen" replace />
  }

  if (error) {
    return (
      <SessionFailed
        error={error}
        onRetry={() => {
          setError(null)
          setAttempt((current) => current + 1)
        }}
      />
    )
  }

  if (!session) return <SessionLoading />

  if (!value) return <NoTeam user={session.user} onRefresh={refresh} />

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const context = React.useContext(SessionContext)

  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider")
  }

  return context
}

function SessionLoading() {
  return (
    <AuthCard width={340}>
      <AuthBrand centered />

      <div className="flex flex-col items-center gap-2.5 text-center">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm text-muted-foreground">Teams werden geladen …</p>
      </div>
    </AuthCard>
  )
}

function SessionFailed({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  return (
    <AuthCard>
      <AuthBrand centered />

      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="grid size-[46px] place-items-center rounded-xl bg-phishing-soft text-phishing">
          <TriangleAlertIcon className="size-[22px]" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Konto konnte nicht geladen werden
        </h1>
        <p className="max-w-[42ch] text-sm text-muted-foreground">
          {errorMessage(error)}
        </p>
      </div>

      <Button size="lg" className="w-full" onClick={onRetry}>
        Erneut versuchen
      </Button>
    </AuthCard>
  )
}

/**
 * Right after the first sign-in nobody belongs to a team yet. Teams are made
 * by the instance admin only, so everyone else waits for an invitation. It is
 * accepted with the next request, asking the server again is enough.
 */
function NoTeam({
  user,
  onRefresh,
}: {
  user: CurrentUser
  onRefresh: () => Promise<Session>
}) {
  const [createOpen, setCreateOpen] = React.useState(false)
  const [checking, setChecking] = React.useState(false)

  async function checkAgain() {
    setChecking(true)
    try {
      // With a team the app replaces this screen, without one it says so
      const { teams } = await onRefresh()
      if (teams.length === 0) {
        toast("Noch in keinem Team", {
          description:
            "Die Einladung ist noch nicht da oder deine E-Mail-Adresse noch nicht bestätigt.",
        })
      }
    } catch (error) {
      toast.error("Teams konnten nicht geladen werden", {
        description: errorMessage(error),
      })
    } finally {
      setChecking(false)
    }
  }

  return (
    <AuthCard>
      <AuthBrand centered />

      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="grid size-[46px] place-items-center rounded-xl bg-accent text-accent-foreground">
          <UserPlusIcon className="size-[22px]" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Du bist noch in keinem Team
        </h1>
        <p className="max-w-[46ch] text-sm text-muted-foreground">
          {user.canCreateTeams
            ? "Analysen werden immer innerhalb eines Teams geteilt. Lege ein Team an, um Mails zu analysieren und Kollegen einzuladen — du wirst automatisch dessen Admin."
            : "Analysen werden immer innerhalb eines Teams geteilt. Bitte einen Team-Admin um eine Einladung und prüf danach hier erneut."}
        </p>
      </div>

      {user.canCreateTeams ? (
        <Button
          size="lg"
          className="w-full"
          onClick={() => setCreateOpen(true)}
        >
          Team erstellen
        </Button>
      ) : (
        <Button
          size="lg"
          className="w-full"
          disabled={checking}
          onClick={checkAgain}
        >
          {checking ? <Spinner /> : null}
          Erneut prüfen
        </Button>
      )}

      <p className="text-center font-mono text-[11px] text-faint">
        Angemeldet als {user.email}
        {authEnabled ? (
          <>
            {" · "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => logout()}
            >
              Abmelden
            </button>
          </>
        ) : null}
      </p>

      {user.canCreateTeams ? (
        <CreateTeamDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={onRefresh}
        />
      ) : null}
    </AuthCard>
  )
}
