import type { ReactNode } from "react"

import { BrandMark } from "@/components/brand-mark"

export function AuthBrand({ centered = false }: { centered?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 ${centered ? "justify-center" : ""}`}
    >
      <BrandMark className="text-primary size-7" />
      <span className="text-[19px] font-bold tracking-tight">phisheye</span>
    </div>
  )
}

type AuthSplitProps = {
  aside: ReactNode
  children: ReactNode
}

/** Two column layout, used for login and registration. */
export function AuthSplit({ aside, children }: AuthSplitProps) {
  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <aside className="bg-muted border-border hidden flex-col justify-between border-r p-12 lg:flex">
        {aside}
      </aside>
      <div className="grid place-items-center px-10 py-12">
        <div className="flex w-full max-w-[360px] flex-col gap-[18px]">
          {children}
        </div>
      </div>
    </div>
  )
}

/** Single centered column, used for everything else. */
export function AuthCard({
  children,
  width = 400,
}: {
  children: ReactNode
  width?: number
}) {
  return (
    <div className="grid min-h-svh place-items-center px-6 py-12">
      <div
        className="flex w-full flex-col gap-[18px]"
        style={{ maxWidth: `${width}px` }}
      >
        {children}
      </div>
    </div>
  )
}
