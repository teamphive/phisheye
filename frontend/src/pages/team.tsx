import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { CheckIcon, TriangleAlertIcon } from "lucide-react"

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
import { fetchTeam } from "@/lib/team"
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
  const { permissions } = useSession()
  const canManage = permissions.manageTeam
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

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
  }, [team.id])

  // Every team keeps at least one admin, so the last one cannot step down.
  const adminCount = (members ?? []).filter(
    (member) => member.role === "admin"
  ).length

  function changeRole(id: string, role: TeamRole) {
    setMembers(
      (current) =>
        current &&
        current.map((member) =>
          member.id === id ? { ...member, role } : member
        )
    )
  }

  // The role only takes effect once the invitation is accepted.
  function changeInvitationRole(id: string, role: TeamRole) {
    setInvitations((current) =>
      current.map((invitation) =>
        invitation.id === id ? { ...invitation, role } : invitation
      )
    )
  }

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <PageHeader
        title={team.name}
        description={`Team · ${members?.length ?? team.memberCount} Mitglieder · geteilte Analyse-Historie`}
        actions={
          <>
            <CreateTeamDialog />
            {canManage ? <InviteDialog /> : null}
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
                        onChange={(role) => changeRole(member.id, role)}
                        disabled={member.role === "admin" && adminCount === 1}
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
                          onConfirm={() =>
                            setMembers(
                              (current) =>
                                current &&
                                current.filter(
                                  (entry) => entry.id !== member.id
                                )
                            )
                          }
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
                        onChange={(role) =>
                          changeInvitationRole(invitation.id, role)
                        }
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
                          <Button variant="ghost" size="sm">
                            Erneut senden
                          </Button>
                          <RemoveMemberDialog
                            name=""
                            email={invitation.email}
                            initials="?"
                            teamName={team.name}
                            isInvitation
                            onConfirm={() =>
                              setInvitations((current) =>
                                current.filter(
                                  (entry) => entry.id !== invitation.id
                                )
                              )
                            }
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
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Team-Einstellungen</CardTitle>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="team-name">Teamname</FieldLabel>
              <Input id="team-name" defaultValue={team.name} />
              <FieldDescription>
                Erscheint im Umschalter oben rechts und in jeder Analyse dieses
                Teams.
              </FieldDescription>
            </Field>
          </CardContent>
          <CardFooter className="justify-end">
            <Button>Speichern</Button>
          </CardFooter>
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
                  onConfirm={() => navigate("/")}
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
                      onConfirm={() => navigate("/")}
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
