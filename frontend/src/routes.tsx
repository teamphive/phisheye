import { Route, Routes } from "react-router"

import { RequirePermission } from "@/components/require-permission"
import { AppLayout } from "@/layouts/app-layout"
import { AuthLayout } from "@/layouts/auth-layout"
import { AnalysisDetailPage } from "@/pages/analysis-detail"
import { AnalysisNewPage } from "@/pages/analysis-new"
import { AnalysesPage } from "@/pages/analyses"
import { ForbiddenPage } from "@/pages/forbidden"
import { MonitoringPage } from "@/pages/monitoring"
import { NotFoundPage } from "@/pages/not-found"
import { NotificationsPage } from "@/pages/notifications"
import { OverviewPage } from "@/pages/overview"
import { SettingsPage } from "@/pages/settings"
import { TeamPage } from "@/pages/team"
import { SessionExpiredPage } from "@/pages/auth/session-expired"

// All routes live in this one file. The team context comes from the session,
// so no route carries a team id. Login, 2FA and passwords are Keycloak's
// pages, drawn by the theme in src/keycloak-theme.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/analysen" element={<AnalysesPage />} />
        <Route
          path="/analysen/neu"
          element={
            <RequirePermission permission="analyze">
              <AnalysisNewPage />
            </RequirePermission>
          }
        />
        <Route path="/analysen/:id" element={<AnalysisDetailPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route
          path="/monitoring"
          element={
            <RequirePermission permission="monitor">
              <MonitoringPage />
            </RequirePermission>
          }
        />
        <Route path="/benachrichtigungen" element={<NotificationsPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="/kein-zugriff" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/sitzung-abgelaufen" element={<SessionExpiredPage />} />
      </Route>
    </Routes>
  )
}
