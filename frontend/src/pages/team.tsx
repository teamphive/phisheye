import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { CheckIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { CreateTeamDialog } from "@/components/create-team-dialog"
import { InviteDialog } from "@/components/invite-dialog"
import { PageHeader } from "@/components/page-header"
import { RemoveMemberDialog } from "@/components/remove-member-dialog"
import { ReportDomainsCard } from "@/components/report-domains-card"
import { useSession } from "@/components/session-provider"
import { TeamDangerDialog } from "@/components/team-danger-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { errorMessage } from "@/lib/api"
import { formatDate } from "@/lib/format"
import {
  changeInvitationRole,
  changeMemberRole,
  deleteTeam,
  fetchTeam,
  leaveTeam,
  removeMember,
  renameTeam,
  resendInvitation,
  revokeInvitation,
} from "@/lib/team"
import { roleLabel, type Team, type TeamRole } from "@/mocks/session"
import type { Invitation, Member } from "@/mocks/team"

const roles: TeamRole[] = ["analyst", "admin", "audit"]

function RolePicker({
  value,
  onChange,
  disabled,
  readOnly,
}: {
  value: TeamRole
  onChange: (role: TeamRole) => void
  disabled?: boolean
  /** Only admins change roles, everyone else just sees them. */
  readOnly?: boolean
}) {
  if (readOnly) return <span className="text-[13px]">{roleLabel[value]}</span>

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as TeamRole)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="w-[120px]">
        <SelectValue>{(role) => roleLabel[role as TeamRole]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role} value={role}>
            {roleLabel[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TwoFactorState({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-clean">
        <CheckIcon className="size-3.5" />
        Aktiv
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-suspicious">
      <TriangleAlertIcon className="size-3.5" />
      Nicht eingerichtet
    </span>
  )
}

export function TeamPage() {
  const { activeTeam } = useSession()

  // Another team is another roster: remounting drops members, domains and the
  // form fields of the previous team at once.
  return <TeamView key={activeTeam.id} team={activeTeam} />
}

function TeamView({ team }: { team: Team }) {
  const navigate = useNavigate()
  const { permissions, refresh } = useSession()
  const canManage = permissions.manageTeam
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  // Counts up to fetch the roster again, the old one stays until then
  const [rosterVersion, setRosterVersion] = useState(0)
  // The member or invitation a request is running for
  const [busyId, setBusyId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState(team.name)
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    let active = true
    fetchTeam(team.id).then(
      (roster) => {
        if (!active) return
        setMembers(roster.members)
        setInvitations(roster.invitations)
      },
      (error: unknown) => {
        if (active) setLoadError(errorMessage(error))
      }
    )
    return () => {
      active = false
    }
  }, [team.id, rosterVersion])

  // Every team keeps at least one admin, so the last one cannot step down.
  const adminCount = (members ?? []).filter(
    (member) => member.role === "admin"
  ).length

  // Teams, names and the own role live in the session as well
  async function reloadSession() {
    try {
      await refresh()
    } catch (error) {
      toast.error("Teams konnten nicht neu geladen werden", {
        description: errorMessage(error),
      })
    }
  }

  async function changeRole(member: Member, role: TeamRole) {
    setBusyId(member.id)
    try {
      await changeMemberRole(team.id, member.id, role)
    } catch (error) {
      toast.error("Rolle konnte nicht geändert werden", {
        description: errorMessage(error),
      })
      return
    } finally {
      setBusyId(null)
    }

    setMembers(
      (current) =>
        current &&
        current.map((entry) =>
          entry.id === member.id ? { ...entry, role } : entry
        )
    )
    toast.success(`${member.name} ist jetzt ${roleLabel[role]}`)

    // The own role decides what the interface offers
    if (member.isSelf) await reloadSession()
  }

  async function remove(member: Member) {
    setBusyId(member.id)
    try {
      await removeMember(team.id, member.id)
      setMembers(
        (current) =>
          current && current.filter((entry) => entry.id !== member.id)
      )
      toast.success(`${member.name} entfernt`)
    } catch (error) {
      toast.error("Mitglied konnte nicht entfernt werden", {
        description: errorMessage(error),
      })
    } finally {
      setBusyId(null)
    }
  }

  // The role only takes effect once the invitation is accepted.
  async function changeInvitation(invitation: Invitation, role: TeamRole) {
    setBusyId(invitation.id)
    try {
      await changeInvitationRole(team.id, invitation.id, role)
      setInvitations((current) =>
        current.map((entry) =>
          entry.id === invitation.id ? { ...entry, role } : entry
        )
      )
    } catch (error) {
      toast.error("Rolle konnte nicht geändert werden", {
        description: errorMessage(error),
      })
    } finally {
      setBusyId(null)
    }
  }

  async function revoke(invitation: Invitation) {
    setBusyId(invitation.id)
    try {
      await revokeInvitation(team.id, invitation.id)
      setInvitations((current) =>
        current.filter((entry) => entry.id !== invitation.id)
      )
      toast.success(`Einladung an ${invitation.email} zurückgezogen`)
    } catch (error) {
      toast.error("Einladung konnte nicht zurückgezogen werden", {
        description: errorMessage(error),
      })
    } finally {
      setBusyId(null)
    }
  }

  async function resend(invitation: Invitation) {
    setBusyId(invitation.id)
    try {
      const fresh = await resendInvitation(team.id, invitation)
      setInvitations((current) =>
        current.map((entry) => (entry.id === invitation.id ? fresh : entry))
      )
      toast.success(`Einladung an ${invitation.email} erneut verschickt`)
    } catch (error) {
      toast.error("Einladung konnte nicht erneut verschickt werden", {
        description: errorMessage(error),
      })
      // It may be withdrawn already without the new one, the server knows
      setRosterVersion((current) => current + 1)
    } finally {
      setBusyId(null)
    }
  }

  async function rename(event: FormEvent) {
    event.preventDefault()

    const name = teamName.trim()
    if (!name || name === team.name) return

    setRenaming(true)
    try {
      await renameTeam(team.id, name)
      toast.success(`Team heißt jetzt ${name}`)
    } catch (error) {
      toast.error("Umbenennen fehlgeschlagen", {
        description: errorMessage(error),
      })
      return
    } finally {
      setRenaming(false)
    }

    await reloadSession()
  }

  // Errors stay in the dialog, it explains the last admin and the last team.
  async function leave() {
    const self = members?.find((member) => member.isSelf)
    if (!self) throw new Error("Deine Mitgliedschaft wurde nicht gefunden.")

    await leaveTeam(team.id, self.id)
    toast.success(`Du hast ${team.name} verlassen`)
    navigate("/")
    await reloadSession()
  }

  async function removeTeam() {
    await deleteTeam(team.id)
    toast.success(`${team.name} gelöscht`)
    navigate("/")
    await reloadSession()
  }

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <PageHeader
        title={team.name}
        description={`Team · ${members?.length ?? team.memberCount} Mitglieder · geteilte Analyse-Historie`}
        actions={
          <>
            <CreateTeamDialog onCreated={refresh} />
            {canManage ? (
              <InviteDialog
                teamId={team.id}
                onInvited={(invitation) =>
                  setInvitations((current) => [...current, invitation])
                }
              />
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="px-0">
          {loadError ? (
            <Alert variant="destructive" className="mx-(--card-spacing) w-auto">
              <AlertDescription>
                Die Mitglieder konnten nicht geladen werden. {loadError}
              </AlertDescription>
            </Alert>
          ) : members === null ? (
            <div className="flex flex-col">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2.5 border-b border-border px-(--card-spacing) py-3 last:border-b-0"
                >
                  <Skeleton className="size-6 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-[28%]" />
                    <Skeleton className="h-2.5 w-[36%]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitglied</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead className="text-right">Analysen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[10px]">
                            {member.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">
                            {member.name}
                            {member.isSelf ? (
                              <span className="font-normal text-faint">
                                {" "}
                                (du)
                              </span>
                            ) : null}
                          </div>
                          <div className="font-mono text-[11px] text-faint">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RolePicker
                        value={member.role}
                        onChange={(role) => changeRole(member, role)}
                        disabled={
                          busyId === member.id ||
                          (member.role === "admin" && adminCount === 1)
                        }
                        readOnly={!canManage}
                      />
                    </TableCell>
                    <TableCell>
                      <TwoFactorState enabled={member.twoFactorEnabled} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {member.analysisCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.isSelf ? (
                        <span className="text-xs text-faint">—</span>
                      ) : !canManage ? null : (
                        <RemoveMemberDialog
                          name={member.name}
                          email={member.email}
                          initials={member.initials}
                          teamName={team.name}
                          disabled={busyId === member.id}
                          onConfirm={() => remove(member)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[10px]">
                            ?
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-muted-foreground">
                            {invitation.email}
                          </div>
                          <div className="font-mono text-[11px] text-faint">
                            Einladung verschickt am{" "}
                            {formatDate(invitation.invitedAt)}
                          </div>
                          <Badge variant="suspicious" className="mt-1">
                            Ausstehend
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RolePicker
                        value={invitation.role}
                        onChange={(role) => changeInvitation(invitation, role)}
                        disabled={busyId === invitation.id}
                        readOnly={!canManage}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-faint">—</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-faint">
                      —
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {canManage ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === invitation.id}
                            onClick={() => resend(invitation)}
                          >
                            Erneut senden
                          </Button>
                          <RemoveMemberDialog
                            name=""
                            email={invitation.email}
                            initials="?"
                            teamName={team.name}
                            isInvitation
                            disabled={busyId === invitation.id}
                            onConfirm={() => revoke(invitation)}
                          />
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReportDomainsCard
        teamId={team.id}
        teamName={team.name}
        isAdmin={canManage}
      />

      {canManage ? (
        <Card>
          <form onSubmit={rename} className="contents">
            <CardHeader className="border-b">
              <CardTitle className="text-sm">Team-Einstellungen</CardTitle>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="team-name">Teamname</FieldLabel>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  disabled={renaming}
                />
                <FieldDescription>
                  Erscheint im Umschalter oben rechts und in jeder Analyse
                  dieses Teams.
                </FieldDescription>
              </Field>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                type="submit"
                disabled={
                  renaming || !teamName.trim() || teamName.trim() === team.name
                }
              >
                {renaming ? <Spinner /> : null}
                Speichern
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <ItemGroup className="gap-0">
            <Item className="px-0 py-3.5">
              <ItemContent>
                <ItemTitle>Team verlassen</ItemTitle>
                <ItemDescription>
                  Du verlierst den Zugriff auf die Analysen dieses Teams.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <TeamDangerDialog
                  mode="leave"
                  teamName={team.name}
                  onConfirm={leave}
                />
              </ItemActions>
            </Item>

            {canManage ? (
              <>
                <ItemSeparator className="my-0" />

                <Item className="px-0 py-3.5">
                  <ItemContent>
                    <ItemTitle>Team löschen</ItemTitle>
                    <ItemDescription>
                      Löscht das Team mit allen Analysen für alle Mitglieder.
                      Lässt sich nicht rückgängig machen.
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <TeamDangerDialog
                      mode="delete"
                      teamName={team.name}
                      onConfirm={removeTeam}
                    />
                  </ItemActions>
                </Item>
              </>
            ) : null}
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  )
}
