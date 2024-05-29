#!/bin/bash
# SC2034: <variable> appears unused.
# https://www.shellcheck.net/wiki/SC2034
# shellcheck disable=SC2034
# shellcheck disable=SC2086,SC2223

set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

# Default required variables, assert that they are set, and document optional variables
: ${FULL_REPORT:=false} # Valid values: true, false
: ${TYPE:=NONE}         # Valid values: PR, RELEASE, MASTER, MASTER_UNSTABLE, CLOUD, CLOUD_UNSTABLE, NONE (which is the same as omitting it); also known as REPORT_TYPE
: ${WEBHOOK_URL:-}      # Optional. Mattermost webhook to post the report back to
: ${RELEASE_DATE:-}     # Optional. If set, its value will be included in the report as the release date of the tested artifact
if [ "$TYPE" = "PR" ]; then
  # In this case, we expect the PR number to be present in the BRANCH variable
  BRANCH_REGEX='^server-pr-[0-9]+$'
  if ! grep -qE "${BRANCH_REGEX}"<<<"$BRANCH"; then
    mme2e_log "Error: when using TYPE=PR, the BRANCH variable should respect regex '$BRANCH_REGEX'. Aborting." >&2
    exit 1
  fi
  export PULL_REQUEST="https://github.com/mattermost/mattermost/pull/${BRANCH##*-}"
fi

# Env vars used during the test. Their values will be included in the report
: ${BRANCH:?} # May be either a ref, a commit hash, or 'server-pr-PRNUMBER' (if TYPE=PR)
: ${BUILD_ID:?}
: ${MM_ENV:-}
: ${SERVER:-} # May be either 'onprem' or 'cloud'

# Populate intermediate variables
export BUILD_TAG="${SERVER_IMAGE##*/}"
export MM_DOCKER_IMAGE="${BUILD_TAG%%:*}" # NB: the 'mattermostdevelopment/' prefix is assumed
export MM_DOCKER_TAG="${BUILD_TAG##*:}"
export SERVER_TYPE="${SERVER}"
if grep -q 'UNSTABLE' <<<"$TYPE"; then
  export TEST_TYPE=prod
else
  export TEST_TYPE=unstable
fi

if [ -n "${TM4J_API_KEY:-}" ]; then
  export TM4J_ENABLE=true
  export JIRA_PROJECT_KEY=MM
  case "${SERVER}-${TYPE%%_UNSTABLE}" in
  onprem-RELEASE)
    export TM4J_FOLDER_ID="2014475"
    export TM4J_ENVIRONMENT_SUFFIX="release-${SERVER_TYPE}-ent"
    ;;
  cloud-RELEASE)
    export TM4J_FOLDER_ID="2014474"
    export TM4J_ENVIRONMENT_SUFFIX="release-${SERVER_TYPE}-ent"
    ;;
  onprem-MASTER)
    export TM4J_FOLDER_ID="2014476"
    export TM4J_ENVIRONMENT_SUFFIX="master-${SERVER_TYPE}-ent-${TEST_TYPE}"
    ;;
  cloud-CLOUD)
    export TM4J_FOLDER_ID="2014479"
    export TM4J_ENVIRONMENT_SUFFIX="master-${SERVER_TYPE}-ent-${TEST_TYPE}"
    ;;
  *)
    mme2e_log "Error: unsupported Zephyr environment for the requested report (SERVER=${SERVER}, TYPE=${TYPE}). Aborting." >&2
    exit 1
  esac
  export TM4J_ENVIRONMENT_NAME="${TEST@u}/${BROWSER@u}/${TM4J_ENVIRONMENT_SUFFIX}"
  : ${TEST_CYCLE_LINK_PREFIX:?}
  : ${TM4J_CYCLE_KEY:-}  # Optional. Populated automatically by the reporting script
  : ${TM4J_CYCLE_NAME:-} # Optional. Populated automatically by the reporting script
  mme2e_log "TMJ4 integration enabled. Environment: $TM4J_ENVIRONMENT_NAME"
fi

if [ -n "${DIAGNOSTIC_WEBHOOK_URL:-}" ]; then
  : ${DIAGNOSTIC_USER_ID:?}
  : ${DIAGNOSTIC_TEAM_ID:?}
  mme2e_log "Diagnostic report upload enabled."
fi

if [ -n "${AWS_S3_BUCKET:-}" ]; then
  : ${AWS_ACCESS_KEY_ID:?}
  : ${AWS_SECRET_ACCESS_KEY:?}
  mme2e_log "S3 report upload enabled."
fi

cd ../cypress/
if [ ! -d "results/" ]; then
  mme2e_log "Error: 'results/' directory does not exist. Aborting report generation." >&2
  exit 1
fi

npm i
node save_report.js
