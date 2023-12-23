#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

case $TEST in
cypress)
  ./server.run_cypress.sh
  ;;
playwright)
  ./server.run_playwright.sh
  ;;
none)
  mme2e_log "Running with TEST=$TEST. No tests to run."
  exit 0
  ;;
*)
  mme2e_log "Error, unsupported value for TEST: $TEST" >&2
  mme2e_log "Aborting" >&2
  exit 1
  ;;
esac
