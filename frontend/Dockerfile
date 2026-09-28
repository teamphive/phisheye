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

# login-ui ships useSetClassname.js, the generated Template.tsx imports
# useSetClassName. macOS does not tell them apart, linux does.
RUN cd node_modules/@keycloakify/login-ui/tools \
    && for f in useSetClassname.*; do ln -s "$f" "useSetClassName${f#useSetClassname}"; done

RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
