import { apiEnabled, apiFetch, mockLatency } from "@/lib/api"
import {
  mockMarkRead,
  mockNotifications,
  type Notification,
} from "@/mocks/notifications"

/** The signed in user's notifications, unread first, at most 14 days old. */
export async function fetchNotifications() {
  if (!apiEnabled) {
    await mockLatency(300)
    return mockNotifications()
  }

  return apiFetch<Notification[]>("/notifications")
}

/** Marks the given notifications as read, or all of them without ids. */
export async function markNotificationsRead(ids?: string[]) {
  if (!apiEnabled) {
    await mockLatency()
    return mockMarkRead(ids)
  }

  await apiFetch<void>(
    "/notifications/read",
    ids
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        }
      : { method: "POST" }
  )
}
