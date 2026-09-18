import { Route, Routes } from "react-router"

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
import { LoginPage } from "@/pages/auth/login"
import { PasswordForgotPage } from "@/pages/auth/password-forgot"
import { PasswordResetPage } from "@/pages/auth/password-reset"
import { RegisterPage } from "@/pages/auth/register"
import { SessionExpiredPage } from "@/pages/auth/session-expired"
import { TwoFactorPage } from "@/pages/auth/two-factor"
import { TwoFactorSetupPage } from "@/pages/auth/two-factor-setup"

// All routes live in this one file. The team context comes from the session,
// so no route carries a team id.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/analysen" element={<AnalysesPage />} />
        <Route path="/analysen/neu" element={<AnalysisNewPage />} />
        <Route path="/analysen/:id" element={<AnalysisDetailPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/benachrichtigungen" element={<NotificationsPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="/kein-zugriff" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/2fa" element={<TwoFactorPage />} />
        <Route path="/registrierung" element={<RegisterPage />} />
        <Route path="/einrichtung/2fa" element={<TwoFactorSetupPage />} />
        <Route path="/passwort-vergessen" element={<PasswordForgotPage />} />
        <Route path="/passwort-neu" element={<PasswordResetPage />} />
        <Route path="/sitzung-abgelaufen" element={<SessionExpiredPage />} />
      </Route>
    </Routes>
  )
}
