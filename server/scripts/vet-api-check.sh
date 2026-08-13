#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

API_YAML=$ROOT../api/v4/html/static/mattermost-openapi-v4.yaml
OUTPUT=$($GO vet -vettool=$GOBIN/mattermost-govet -openApiSync -openApiSync.spec=$API_YAML ./... 2>&1 || true)

echo "OpenAPI vet output"
echo "=================="
echo "$OUTPUT"

OUTPUT_EXCLUDING_IGNORED=$(echo "$OUTPUT" | grep -Fv \
    -e 'go: downloading' \
2>&1 || true)

if [[ ! -z "${OUTPUT_EXCLUDING_IGNORED// }" ]]; then
    echo "Failing vet output"
    echo "=================="
    echo "$OUTPUT_EXCLUDING_IGNORED"
    exit 1
else
    echo "openApiSync passed."
    exit 0
fi
