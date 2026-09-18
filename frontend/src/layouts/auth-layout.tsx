import { Outlet } from "react-router"

export function AuthLayout() {
  return (
    <div className="bg-card min-h-svh">
      <Outlet />
    </div>
  )
}
