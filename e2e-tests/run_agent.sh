#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

FRAMEWORK=${FRAMEWORK:-}
E2E_SCOPE=${E2E_SCOPE:-smoke}
SPEC_FILES=${SPEC_FILES:-}
LOG_DIR=${LOG_DIR:-logs/agent}
TAIL_LINES=${TAIL_LINES:-60}

infer_framework() {
  local spec_files=${1:-}
  local inferred=""

  [ -n "$spec_files" ] || return 0

  IFS=',' read -r -a specs <<<"$spec_files"
  for spec in "${specs[@]}"; do
    case "$spec" in
    tests/integration/*)
      if [ -z "$inferred" ]; then
        inferred="cypress"
      elif [ "$inferred" != "cypress" ]; then
        echo "mixed"
        return 0
      fi
      ;;
    specs/*)
      if [ -z "$inferred" ]; then
        inferred="playwright"
      elif [ "$inferred" != "playwright" ]; then
        echo "mixed"
        return 0
      fi
      ;;
    *)
      echo "unknown"
      return 0
      ;;
    esac
  done

  echo "$inferred"
}

if [ -z "$FRAMEWORK" ]; then
  if [ -n "$SPEC_FILES" ]; then
    FRAMEWORK=$(infer_framework "$SPEC_FILES")
    case "$FRAMEWORK" in
    cypress | playwright)
      ;;
    mixed)
      echo "[agent] SPEC_FILES spans multiple frameworks; set FRAMEWORK explicitly." >&2
      exit 1
      ;;
    *)
      echo "[agent] Could not infer FRAMEWORK from SPEC_FILES; set FRAMEWORK explicitly." >&2
      exit 1
      ;;
    esac
  else
    FRAMEWORK=playwright
  fi
fi

mkdir -p "$LOG_DIR"

RUN_ID="${FRAMEWORK}-${E2E_SCOPE}-$(date +%Y%m%dT%H%M%S)"
RUN_LOG="${LOG_DIR}/${RUN_ID}.log"

summary_path_for() {
  case "$1" in
  playwright)
    echo "playwright/results/summary.json"
    ;;
  cypress)
    echo "cypress/results/summary.json"
    ;;
  *)
    return 1
    ;;
  esac
}

print_summary() {
  local framework=${1?}
  local summary_path
  summary_path=$(summary_path_for "$framework")

  if [ ! -f "$summary_path" ]; then
    echo "[agent] ${framework}: no summary file found at ${summary_path}"
    return 0
  fi

  python3 - "$framework" "$summary_path" <<'PY'
import json, sys
framework, path = sys.argv[1], sys.argv[2]
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
print(f"[agent] {framework}: passed={data.get('passed', 'n/a')} failed={data.get('failed', 'n/a')} failed_expected={data.get('failed_expected', 'n/a')}")
print(f"[agent] {framework}: summary={path}")
PY
}

echo "[agent] framework=${FRAMEWORK} scope=${E2E_SCOPE} log=${RUN_LOG}"
if [ -n "$SPEC_FILES" ]; then
  echo "[agent] specs=${SPEC_FILES}"
fi

set +e
FRAMEWORK="$FRAMEWORK" \
E2E_SCOPE="$E2E_SCOPE" \
SPEC_FILES="$SPEC_FILES" \
PLAYWRIGHT_TEST_FILTER="${PLAYWRIGHT_TEST_FILTER:-}" \
CYPRESS_TEST_FILTER="${CYPRESS_TEST_FILTER:-}" \
ENABLED_DOCKER_SERVICES="${ENABLED_DOCKER_SERVICES:-}" \
BROWSER="${BROWSER:-}" \
bash ./run_local.sh >"$RUN_LOG" 2>&1
status=$?
set -e

if [ "$status" -ne 0 ]; then
  echo "[agent] run failed with exit code ${status}"
  echo "[agent] tail of ${RUN_LOG}:"
  tail -n "$TAIL_LINES" "$RUN_LOG" || true
  exit "$status"
fi

case "$FRAMEWORK" in
playwright | cypress)
  print_summary "$FRAMEWORK"
  ;;
all)
  print_summary playwright
  print_summary cypress
  ;;
esac

echo "[agent] full_log=${RUN_LOG}"
