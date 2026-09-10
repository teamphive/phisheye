import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { ActivityIcon, BellIcon, MailIcon, UsersIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatDate, formatRelativeTime, formatTime } from "@/lib/format"
import {
  notifications as initialNotifications,
  type Notification,
  type NotificationKind,
  type NotificationTone,
} from "@/mocks/notifications"

type Filter = "all" | "unread" | NotificationKind
type Bucket = "today" | "yesterday" | "older"

const kindIcon: Record<NotificationKind, typeof MailIcon> = {
  analysis: MailIcon,
  team: UsersIcon,
  system: ActivityIcon,
}

const toneClass: Record<NotificationTone, string> = {
  phishing: "bg-phishing-soft text-phishing",
  suspicious: "bg-suspicious-soft text-suspicious",
  clean: "bg-clean-soft text-clean",
  info: "bg-accent text-primary",
}

const bucketLabel: Record<Bucket, string> = {
  today: "Heute",
  yesterday: "Gestern",
  older: "Älter",
}

const buckets: Bucket[] = ["today", "yesterday", "older"]

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

function bucketOf(iso: string): Bucket {
  const at = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)

  yesterday.setDate(today.getDate() - 1)

  if (sameDay(at, today)) return "today"
  if (sameDay(at, yesterday)) return "yesterday"
  return "older"
}

// Today says how long ago, yesterday only needs the time, older needs the date.
function timeLabel(iso: string, bucket: Bucket) {
  if (bucket === "today") return formatRelativeTime(iso)
  if (bucket === "yesterday") return formatTime(iso)
  return formatDate(iso)
}

function matches(entry: Notification, filter: Filter) {
  if (filter === "all") return true
  if (filter === "unread") return !entry.read
  return entry.kind === filter
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState(initialNotifications)
  const [filter, setFilter] = useState<Filter>("all")

  const unread = entries.filter((entry) => !entry.read).length

  const grouped = useMemo(() => {
    const visible = entries.filter((entry) => matches(entry, filter))

    return buckets
      .map((bucket) => ({
        bucket,
        items: visible.filter((entry) => bucketOf(entry.createdAt) === bucket),
      }))
      .filter((group) => group.items.length > 0)
  }, [entries, filter])

  function markAllRead() {
    setEntries((current) => current.map((entry) => ({ ...entry, read: true })))
  }

  function open(entry: Notification) {
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, read: true } : item
      )
    )
    navigate(entry.target)
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "Alle" },
    { value: "unread", label: `Ungelesen (${unread})` },
    { value: "analysis", label: "Analysen" },
    { value: "team", label: "Team" },
    { value: "system", label: "System" },
  ]

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Benachrichtigungen"
        description={`${unread} ungelesen · diese Liste sieht nur dein Konto`}
        actions={
          <Button
            variant="outline"
            disabled={unread === 0}
            onClick={markAllRead}
          >
            Alle als gelesen markieren
          </Button>
        }
      />

      <ToggleGroup
        value={[filter]}
        onValueChange={(value) => setFilter((value[0] as Filter) ?? "all")}
        variant="outline"
        size="sm"
      >
        {filters.map((entry) => (
          <ToggleGroupItem key={entry.value} value={entry.value}>
            {entry.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {grouped.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellIcon />
                </EmptyMedia>
                <EmptyTitle>Keine Benachrichtigungen</EmptyTitle>
                <EmptyDescription>
                  Hier erscheint eine Meldung, sobald eine Analyse abgeschlossen
                  ist, jemand dem Team beitritt oder ein Job fehlschlägt.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.bucket}>
            <CardHeader>
              <CardTitle className="text-sm">
                {bucketLabel[group.bucket]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {group.items.map((entry) => {
                  const Icon = kindIcon[entry.kind]

                  return (
                    <Item
                      key={entry.id}
                      render={<button type="button" />}
                      className={
                        entry.read
                          ? "border-l-2 border-l-transparent text-left hover:bg-muted"
                          : "border-l-2 border-l-primary bg-accent/50 text-left hover:bg-accent"
                      }
                      onClick={() => open(entry)}
                    >
                      <ItemMedia
                        variant="icon"
                        className={`size-[30px] rounded-lg ${toneClass[entry.tone]}`}
                      >
                        <Icon />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{entry.title}</ItemTitle>
                        <ItemDescription>{entry.detail}</ItemDescription>
                      </ItemContent>
                      <ItemActions className="font-mono text-[10.5px] text-faint">
                        {timeLabel(entry.createdAt, group.bucket)}
                      </ItemActions>
                    </Item>
                  )
                })}
              </ItemGroup>
            </CardContent>
          </Card>
        ))
      )}

      <p className="text-xs text-muted-foreground">
        Benachrichtigungen werden nach 90 Tagen automatisch entfernt.
      </p>
    </div>
  )
}
