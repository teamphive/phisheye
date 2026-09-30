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
# docker only busts the cache on a build-arg change if the arg appears
# literally in the command, hence the otherwise pointless echo
RUN echo "building for $VITE_KEYCLOAK_URL" && npm run build

# The login theme, packed into a jar by Keycloakify. It calls Maven, the jar
# holds no Java code, so any JDK will do.
FROM build AS theme
RUN apk add --no-cache maven openjdk21-jdk
# under x86_64 emulation on arm64 hosts (e.g. Colima), the JIT compiler
# crashes maven with SIGSEGV, so it runs interpreted only
ENV MAVEN_OPTS="-XX:TieredStopAtLevel=1"
RUN npx keycloakify build

# Keycloak with the theme, built by the keycloak service in docker-compose.yml.
# Keycloak loads every jar in providers at startup.
FROM quay.io/keycloak/keycloak:26.7.3 AS keycloak
COPY --from=theme /app/dist_keycloak/phisheye-keycloak-theme.jar /opt/keycloak/providers/
# mail templates, plain files without a build step
COPY email-theme/ /opt/keycloak/themes/phisheye-email/
# Build time options, baked in once so `start --optimized` skips the rebuild on
# every start. The database stays the H2 file in the keycloak-data volume, set
# explicitly because the default is deprecated in production mode.
ENV KC_DB=dev-file
ENV KC_HTTP_RELATIVE_PATH=/auth
RUN /opt/keycloak/bin/kc.sh build

# last stage, so a build without target gives the app
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
