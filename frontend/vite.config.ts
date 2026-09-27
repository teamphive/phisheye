import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Dates are formatted in the browser's timezone. A fixed one keeps the
    // expected strings the same on a laptop in Berlin and on the CI runner.
    env: { TZ: "UTC" },
    unstubEnvs: true,
    unstubGlobals: true,
    restoreMocks: true,
  },
})
