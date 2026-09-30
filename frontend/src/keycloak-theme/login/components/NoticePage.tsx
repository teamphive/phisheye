import type { ReactNode } from "react"
import {
  CircleCheckIcon,
  ClockIcon,
  InfoIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { PageShell } from "./PageShell"

const tones = {
  info: { icon: InfoIcon, className: "bg-accent text-primary" },
  success: { icon: CircleCheckIcon, className: "bg-clean-soft text-clean" },
  warning: {
    icon: ClockIcon,
    className: "bg-suspicious-soft text-suspicious",
  },
  error: {
    icon: TriangleAlertIcon,
    className: "bg-phishing-soft text-phishing",
  },
}

export type NoticeTone = keyof typeof tones

/**
 * Frame for the pages that only tell something and offer a way on: notes and
 * errors from Keycloak, an expired login, a mail to confirm.
 */
export function NoticePage({
  title,
  heading,
  tone,
  icon,
  children,
  actions,
}: {
  /** For the browser tab. */
  title: string
  heading: ReactNode
  tone: NoticeTone
  /** Takes the place of the tone's own icon. */
  icon?: LucideIcon
  children?: ReactNode
  actions?: ReactNode
}) {
  const Icon = icon ?? tones[tone].icon

  return (
    <PageShell title={title}>
      <AuthCard>
        <AuthBrand centered />

        <div className="flex flex-col items-center gap-2.5 text-center">
          <span
            className={`grid size-[46px] place-items-center rounded-xl ${tones[tone].className}`}
          >
            <Icon className="size-[22px]" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
          {children ? (
            <div className="max-w-[42ch] text-sm text-muted-foreground">
              {children}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-col gap-2.5">{actions}</div>
        ) : null}
      </AuthCard>
    </PageShell>
  )
}
