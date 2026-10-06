import { Outlet } from "react-router"

export function AuthLayout() {
  return (
    <div className="min-h-svh bg-card">
      <Outlet />
    </div>
  )
}
