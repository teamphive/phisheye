/** Static stand-in for the real TOTP QR code. */
export function QrPlaceholder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" shapeRendering="crispEdges" className={className} role="img" aria-label="QR-Code, Platzhalter">
      <rect width="21" height="21" fill="#fff" />
      <g fill="#0f1724">
        <path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" />
        <path d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z" fill="#fff" />
        <path d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2z" />
        <path d="M9 0h1v2H9zM11 1h1v1h-1zM8 3h2v1H8zM10 2h1v3h-1zM12 3h1v2h-1zM9 5h2v1H9zM8 6h1v1H8zM11 6h2v1h-2z" />
        <path d="M0 9h2v1H0zM3 8h1v2H3zM5 9h2v1H5zM1 11h1v1H1zM3 11h2v1H3zM6 11h1v1H6zM0 12h1v1H0zM2 12h1v1H2zM4 12h1v1H4z" />
        <path d="M14 8h1v1h-1zM16 9h2v1h-2zM19 8h2v1h-2zM15 10h1v2h-1zM17 11h1v1h-1zM19 10h1v1h-1zM14 12h2v1h-2zM18 12h3v1h-3zM20 11h1v1h-1z" />
        <path d="M9 8h1v1H9zM11 9h1v1h-1zM8 10h2v1H8zM10 11h1v2h-1zM12 10h1v1h-1zM9 12h1v1H9zM12 12h1v1h-1z" />
        <path d="M8 14h1v2H8zM10 14h2v1h-2zM13 14h1v1h-1zM9 16h1v1H9zM11 16h1v2h-1zM13 16h2v1h-2zM8 18h2v1H8zM12 19h1v1h-1zM10 20h2v1h-2zM14 18h1v2h-1zM16 14h1v1h-1zM18 15h1v1h-1zM20 14h1v2h-1zM16 17h2v1h-2zM19 17h1v1h-1zM17 19h1v2h-1zM19 19h2v1h-2zM15 20h1v1h-1z" />
      </g>
    </svg>
  )
}
