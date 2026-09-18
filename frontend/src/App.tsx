import { BrowserRouter } from "react-router"

import { AppRoutes } from "@/routes"
import { TeamProvider } from "@/components/team-provider"
import { Toaster } from "@/components/ui/sonner"

function App() {
  return (
    <BrowserRouter>
      <TeamProvider>
        <AppRoutes />
      </TeamProvider>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
