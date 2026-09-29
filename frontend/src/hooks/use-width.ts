import { useEffect, useRef, useState } from "react"

/** Width of an element, kept current while it resizes. */
export function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    )
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}
