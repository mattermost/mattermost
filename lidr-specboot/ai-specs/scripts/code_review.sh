#!/usr/bin/env bash
# code_review.sh - Basic code review report

set -euo pipefail

echo "Starting code review..."

if ! command -v agent >/dev/null 2>&1; then
  echo "Error: 'agent' command not found in PATH."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="${SCRIPT_DIR}/review_${TIMESTAMP}.txt"

if agent -p --output-format text \
  "Review the recent code changes and provide feedback on:
  - Code quality and readability
  - Possible bugs or issues
  - Security considerations
  - Best-practices compliance

  Provide specific improvement suggestions." > "${OUTPUT_FILE}"; then
  if [[ -s "${OUTPUT_FILE}" ]]; then
    echo "Code review completed successfully."
    echo "Review saved to: ${OUTPUT_FILE}"
  else
    echo "Code review failed: output file is empty."
    exit 1
  fi
else
  echo "Code review failed while running 'agent'."
  exit 1
fi
