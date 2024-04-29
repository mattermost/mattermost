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
: ${TYPE:=NONE}         # Valid values: PR, RELEASE, MASTER, MASTER_UNSTABLE, CLOUD, CLOUD_UNSTABLE, NONE (which is the same as omitting it)
: ${WEBHOOK_URL:-}      # Optional. Mattermost webhook to post the report back to
: ${RELEASE_DATE:-}     # Optional. If set, its value will be included in the report as the release date of the tested artifact

# Env vars used during the test. Their values will be included in the report
: ${BRANCH:?}
: ${BUILD_ID:?}
: ${MM_ENV:-}

# Populate intermediate variables
export BUILD_TAG="${SERVER_IMAGE##*/}"
export MM_DOCKER_IMAGE="${BUILD_TAG%%:*}" # NB: the 'mattermostdevelopment/' prefix is assumed
export MM_DOCKER_TAG="${BUILD_TAG##*:}"
export SERVER_TYPE="${SERVER}"
# NB: assume that BRANCH follows the convention 'server-pr-${PR_NUMBER}'. If multiple PRs match, the last one is used to generate the link
# Only needed if TYPE=PR
export PULL_REQUEST="https://github.com/mattermost/mattermost/pull/${BRANCH##*-}"

if [ -n "${TM4J_API_KEY:-}" ]; then
  export TM4J_ENABLE=true
  export JIRA_PROJECT_KEY=MM
  export TM4J_ENVIRONMENT_NAME="${TEST}/${BROWSER}/${SERVER}"
  case "${SERVER}" in
  cloud)
    export TM4J_FOLDER_ID="2014474"
    ;;
  *)
    export TM4J_FOLDER_ID="2014475"
    ;;
  esac
  : ${TEST_CYCLE_LINK_PREFIX:?}
  : ${TM4J_CYCLE_KEY:-}
  : ${TM4J_CYCLE_NAME:-}
  mme2e_log "TMJ4 integration enabled."
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
