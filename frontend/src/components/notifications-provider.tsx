/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { toast } from "sonner"

import { errorMessage } from "@/lib/api"
import { fetchNotifications, markNotificationsRead } from "@/lib/notifications"
import type { Notification } from "@/mocks/notifications"

type NotificationsState = {
  /** Null while the first answer is outstanding. */
  entries: Notification[] | null
  loadError: string | null
  unreadCount: number
  markRead: (entry: Notification) => void
  markAllRead: () => void
}

/** New notifications show up within this time, while the tab is visible. */
const refreshInterval = 30_000

const NotificationsContext = React.createContext<
  NotificationsState | undefined
>(undefined)

/**
 * One list for the bell and the notifications page, so reading an entry in
 * one place also shows it as read in the other.
 */
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [entries, setEntries] = React.useState<Notification[] | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // Marked as read here, but not yet confirmed by a fresh list. A refresh that
  // was already on its way must not turn them unread again.
  const pendingRead = React.useRef(new Set<string>())

  React.useEffect(() => {
    let active = true
    let received = false
    let inFlight = false

    function load() {
      if (inFlight) return
      inFlight = true

      fetchNotifications()
        .then(
          (data) => {
            if (!active) return
            received = true

            for (const entry of data) {
              if (entry.read) pendingRead.current.delete(entry.id)
            }
            setEntries(
              data.map((entry) =>
                pendingRead.current.has(entry.id)
                  ? { ...entry, read: true }
                  : entry
              )
            )
            setLoadError(null)
          },
          (error: unknown) => {
            // A failed refresh keeps the last list, only the first load says so.
            if (active && !received) setLoadError(errorMessage(error))
          }
        )
        .finally(() => {
          inFlight = false
        })
    }

    // A hidden tab asks nobody, coming back asks right away.
    function refreshIfVisible() {
      if (document.visibilityState === "visible") load()
    }

    load()
    const timer = setInterval(refreshIfVisible, refreshInterval)
    document.addEventListener("visibilitychange", refreshIfVisible)

    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener("visibilitychange", refreshIfVisible)
    }
  }, [])

  const setRead = React.useCallback((ids: string[] | null, read: boolean) => {
    setEntries(
      (current) =>
        current &&
        current.map((entry) =>
          ids === null || ids.includes(entry.id) ? { ...entry, read } : entry
        )
    )
  }, [])

  // Shown as read right away. If the server refuses, the entry turns unread
  // again, so the badge never claims more than the server knows.
  const markRead = React.useCallback(
    (entry: Notification) => {
      if (entry.read) return

      pendingRead.current.add(entry.id)
      setRead([entry.id], true)
      markNotificationsRead([entry.id]).catch(() => {
        pendingRead.current.delete(entry.id)
        setRead([entry.id], false)
      })
    },
    [setRead]
  )

  const markAllRead = React.useCallback(() => {
    const unreadIds = (entries ?? [])
      .filter((entry) => !entry.read)
      .map((entry) => entry.id)
    if (unreadIds.length === 0) return

    for (const id of unreadIds) pendingRead.current.add(id)
    setRead(null, true)
    markNotificationsRead().catch((error: unknown) => {
      for (const id of unreadIds) pendingRead.current.delete(id)
      setRead(unreadIds, false)
      toast.error("Konnte nicht als gelesen markiert werden", {
        description: errorMessage(error),
      })
    })
  }, [entries, setRead])

  const unreadCount = (entries ?? []).filter((entry) => !entry.read).length

  const value = React.useMemo(
    () => ({ entries, loadError, unreadCount, markRead, markAllRead }),
    [entries, loadError, unreadCount, markRead, markAllRead]
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = React.useContext(NotificationsContext)

  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    )
  }

  return context
}
