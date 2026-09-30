#!/bin/bash
# Renders __NAME__ markers of the realm template from the environment, then
# starts keycloak. The image has bash but no envsubst or sed.
set -euo pipefail

# an "&" in a value must not be read as a match reference
shopt -u patsub_replacement 2>/dev/null || true

json_escape() {
    local value=${1//\\/\\\\}
    printf '%s' "${value//\"/\\\"}"
}

names=(FRONTEND_URL SMTP_HOST SMTP_PORT SMTP_USERNAME SMTP_PASSWORD KEYCLOAK_SERVICE_CLIENT_SECRET)
values=()
for name in "${names[@]}"; do
    values+=("$(json_escape "${!name-}")")
done

mkdir -p /opt/keycloak/data/import

# line by line, replacing in the whole file at once is very slow in bash
while IFS= read -r line || [ -n "$line" ]; do
    if [[ $line == *__* ]]; then
        for i in "${!names[@]}"; do
            line=${line//__${names[$i]}__/${values[$i]}}
        done
    fi
    printf '%s\n' "$line"
done </opt/keycloak/template/realm-export.json >/opt/keycloak/data/import/realm-export.json

exec /opt/keycloak/bin/kc.sh "$@"
