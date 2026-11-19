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
    -e 'Cannot find /api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/options method: GET in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/options method: POST in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/options method: PATCH in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/options method: DELETE in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/channels/{channel_id}/join_request method: POST in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/channels/{channel_id}/join_request method: GET in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/channels/{channel_id}/join_request method: DELETE in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/channels/{channel_id}/join_requests method: GET in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/channels/{channel_id}/join_requests/count method: GET in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/channels/{channel_id}/join_requests/{request_id} method: PATCH in OpenAPI 3 spec.' \
    -e 'Cannot find /api/v4/users/{user_id}/channel_join_requests method: GET in OpenAPI 3 spec.' \
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
