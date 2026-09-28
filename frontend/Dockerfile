FROM node:22-alpine AS build
WORKDIR /app

# Vite bakes these into the bundle at build time, so they must be the URLs
# the browser uses
ARG VITE_API_URL=/api
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID

# whole project first: the postinstall of keycloakify needs the vite config
COPY . .
RUN npm ci
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
