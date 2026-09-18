import { useState } from "react"
import { useNavigate } from "react-router"
import { CheckIcon, TriangleAlertIcon } from "lucide-react"

import { CreateTeamDialog } from "@/components/create-team-dialog"
import { InviteDialog } from "@/components/invite-dialog"
import { PageHeader } from "@/components/page-header"
import { RemoveMemberDialog } from "@/components/remove-member-dialog"
import { TeamDangerDialog } from "@/components/team-danger-dialog"
import { useTeams } from "@/components/team-provider"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import { roleLabel, type TeamRole } from "@/mocks/session"
import {
  invitations as initialInvitations,
  members as initialMembers,
} from "@/mocks/team"

const roles: TeamRole[] = ["analyst", "admin", "audit"]

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: TeamRole
  onChange: (role: TeamRole) => void
  disabled?: boolean
}) {
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
  const navigate = useNavigate()
  const { activeTeam } = useTeams()
  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)

  // Every team keeps at least one admin, so the last one cannot step down.
  const adminCount = members.filter((member) => member.role === "admin").length

  function changeRole(id: string, role: TeamRole) {
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, role } : member))
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
        title={activeTeam.name}
        description={`Team · ${activeTeam.memberCount} Mitglieder · geteilte Analyse-Historie`}
        actions={
          <>
            <CreateTeamDialog />
            <InviteDialog />
          </>
        }
      />

      <Card>
        <CardContent className="px-0">
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
                    ) : (
                      <RemoveMemberDialog
                        name={member.name}
                        email={member.email}
                        initials={member.initials}
                        teamName={activeTeam.name}
                        onConfirm={() =>
                          setMembers((current) =>
                            current.filter((entry) => entry.id !== member.id)
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
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-faint">—</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-faint">
                    —
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm">
                      Erneut senden
                    </Button>
                    <RemoveMemberDialog
                      name=""
                      email={invitation.email}
                      initials="?"
                      teamName={activeTeam.name}
                      isInvitation
                      onConfirm={() =>
                        setInvitations((current) =>
                          current.filter((entry) => entry.id !== invitation.id)
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Team-Einstellungen</CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="team-name">Teamname</FieldLabel>
            <Input id="team-name" defaultValue={activeTeam.name} />
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
                  teamName={activeTeam.name}
                  onConfirm={() => navigate("/")}
                />
              </ItemActions>
            </Item>

            <ItemSeparator className="my-0" />

            <Item className="px-0 py-3.5">
              <ItemContent>
                <ItemTitle>Team löschen</ItemTitle>
                <ItemDescription>
                  Löscht das Team mit allen Analysen für alle Mitglieder. Lässt
                  sich nicht rückgängig machen.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <TeamDangerDialog
                  mode="delete"
                  teamName={activeTeam.name}
                  onConfirm={() => navigate("/")}
                />
              </ItemActions>
            </Item>
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  )
}
