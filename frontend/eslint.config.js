import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Keycloak's own scripts, copied into public/ by Keycloakify
  globalIgnores([
    'dist',
    'dist_keycloak',
    'public/keycloak-theme',
    'public/keycloakify-dev-resources',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn-generated components export their variants next to the
    // component itself, which conflicts with react-refresh
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Files synced from @keycloakify/login-ui start with a blanket
    // eslint-disable, which would otherwise be reported as unused
    files: ['src/keycloak-theme/**/*.{ts,tsx}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
])
