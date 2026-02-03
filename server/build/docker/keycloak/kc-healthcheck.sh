#!/bin/bash
set -eu -o pipefail

/opt/keycloak/bin/kcadm.sh config credentials -x --server http://localhost:8080 --realm master --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD"
/opt/keycloak/bin/kcadm.sh get realms/mattermost >/dev/null
