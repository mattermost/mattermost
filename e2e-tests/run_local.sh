#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"

FRAMEWORK=${FRAMEWORK:-${TEST:-all}}
E2E_SCOPE=${E2E_SCOPE:-full}
EXPLICIT_ENABLED_DOCKER_SERVICES=${ENABLED_DOCKER_SERVICES-__MME2E_UNSET__}

# Source the shared E2E environment from inside .ci so its relative paths stay
# valid, and pre-set SERVER so local-mode defaults are computed correctly.
export SERVER=local
if [ "$FRAMEWORK" != "all" ]; then
  export TEST="$FRAMEWORK"
fi
pushd ./.ci >/dev/null
. ./.e2erc
popd >/dev/null

case "$E2E_SCOPE" in
smoke)
  LOCAL_SERVICES_DEFAULT="inbucket"
  PLAYWRIGHT_TEST_FILTER_DEFAULT='--grep @smoke'
  CYPRESS_TEST_FILTER_DEFAULT='--stage=@prod --group=@smoke'
  ;;
full)
  LOCAL_SERVICES_DEFAULT="inbucket minio openldap elasticsearch keycloak"
  PLAYWRIGHT_TEST_FILTER_DEFAULT='--grep-invert "@visual"'
  CYPRESS_TEST_FILTER_DEFAULT='--stage="@prod" --exclude-group="@te_only,@cloud_only,@high_availability" --sortFirst="@compliance_export,@elasticsearch,@ldap_group,@ldap" --sortLast="@saml,@keycloak,@plugin,@plugins_uninstall,@mfa,@license_removal"'
  ;;
*)
  mme2e_log "Error, unsupported E2E_SCOPE: $E2E_SCOPE" >&2
  exit 1
  ;;
esac

if [ "$EXPLICIT_ENABLED_DOCKER_SERVICES" = "__MME2E_UNSET__" ]; then
  ENABLED_DOCKER_SERVICES=$LOCAL_SERVICES_DEFAULT
else
  ENABLED_DOCKER_SERVICES=$EXPLICIT_ENABLED_DOCKER_SERVICES
fi
PLAYWRIGHT_TEST_FILTER=${PLAYWRIGHT_TEST_FILTER:-$PLAYWRIGHT_TEST_FILTER_DEFAULT}
CYPRESS_TEST_FILTER=${CYPRESS_TEST_FILTER:-$CYPRESS_TEST_FILTER_DEFAULT}
MAKE_TARGET="run-test"

if [ -n "${SPEC_FILES:-}" ]; then
  if [ "$FRAMEWORK" = "all" ]; then
    mme2e_log "Error: SPEC_FILES cannot be used with FRAMEWORK=all" >&2
    exit 1
  fi
  MAKE_TARGET="run-specs"
fi

run_framework() {
  local TOOL=${1?}
  local FILTER=${2?}
  mme2e_log "Running local source E2E for ${TOOL} (${E2E_SCOPE})"
  env \
    SERVER=local \
    TEST="$TOOL" \
    ENABLED_DOCKER_SERVICES="$ENABLED_DOCKER_SERVICES" \
    TEST_FILTER="$FILTER" \
    BROWSER="${BROWSER:-$BROWSER_DEFAULT}" \
    SPEC_FILES="${SPEC_FILES:-}" \
    make start-server "$MAKE_TARGET"
}

case "$FRAMEWORK" in
playwright)
  run_framework playwright "$PLAYWRIGHT_TEST_FILTER"
  ;;
cypress)
  run_framework cypress "$CYPRESS_TEST_FILTER"
  ;;
all)
  run_framework playwright "$PLAYWRIGHT_TEST_FILTER"
  run_framework cypress "$CYPRESS_TEST_FILTER"
  ;;
*)
  mme2e_log "Error, unsupported FRAMEWORK: $FRAMEWORK" >&2
  exit 1
  ;;
esac
