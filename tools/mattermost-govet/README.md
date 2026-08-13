# Mattermost Go Vet

This package contains mattermost-specific go-vet rules that are used to maintain code consistency in `mattermost`.

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
1. **wrapError** - check for original errors being passed as details rather than wrapped
1. **noSelectStar** - check for SQL queries using SELECT * which breaks forwards compatibility
1. **requestCtxNaming** - check that request.CTX parameters are consistently named 'rctx'

## Running Locally

Mattermost Go Vet lives in the `tools/mattermost-govet/` directory of the `mattermost/mattermost` repo. It can also be imported and installed independently for use by plugins or other projects:

```bash
go install github.com/mattermost/mattermost/tools/mattermost-govet@latest
```

To build and run locally from the repo:

```bash
cd tools/mattermost-govet && go install .
go vet -vettool=$(go env GOPATH)/bin/mattermost-govet ./...
```
