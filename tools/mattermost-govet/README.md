# Mattermost Go Vet

This repository contains mattermost-specific go-vet rules that are used to maintain code consistency in `mattermost`.

## Included analyzers

1. **equalLenAsserts** - check for (require/assert).Equal(t, X, len(Y))
1. **inconsistentReceiverName** - check for inconsistent receiver names in the methods of a struct
1. **license** - check the license header
1. **openApiSync** - check for inconsistencies between OpenAPI spec and the source code
1. **structuredLogging** - check invalid usage of logging (must use structured logging)
1. **tFatal** - check invalid usage of t.Fatal assertions (instead of testify methods)
1. **apiAuditLogs** - check that audit records are properly created in the API layer
1. **rawSql** - check invalid usage of raw SQL queries instead of using the squirrel lib
1. **emptyStrCmp** - check for idiomatic empty string comparisons
1. **pointerToSlice** - check for usage of pointer to slice in function definitions
1. **mutexLock** - check for cases where a mutex is left locked before returning
1. **wrapError** - check for original errors being passed as details rather then wrapped
1. **noSelectStar** - check for SQL queries using SELECT * which breaks forwards compatibility
1. **requestCtxNaming** - check that request.CTX parameters are consistently named 'rctx'

## Running Locally

Mattermost Go Vet is designed to run against the `mattermost/mattermost` repo. It assumes that you have the `mattermost/mattermost` and `mattermost/mattermost-govet` in the same top-level directory.

The following can be used to test locally:

```
# ENV vars
MM_ROOT=</path/to/mattermost/>
MM_GOVET=</path/to/mattermost-govet>
GOBIN=</path/to/go/bin>
API_YAML=$MM_ROOT/api/v4/html/static/mattermost-openapi-v4.yaml

# Make OpenAPI file
if [ ! -f $API_YAML ]; then
	make -C $MM_ROOT/api build
fi

# Install
go install $MM_GOVET

# Run
go vet -vettool=$GOBIN/mattermost-govet -openApiSync -openApiSync.spec=$API_YAML ./... 2>&1 || true
```
