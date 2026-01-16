# Plan 01-01 Summary: gRPC dependency setup + protobuf build configuration

## Status: COMPLETE

## Tasks Completed: 4/4

### Task 1: Create directory skeleton
- Created `server/public/pluginapi/grpc/proto/` for proto source files
- Created `server/public/pluginapi/grpc/generated/go/pluginapiv1/` for generated Go code

### Task 2: Add bootstrap.proto
- Created minimal `bootstrap.proto` with:
  - `syntax = "proto3";`
  - Package: `mattermost.pluginapi.v1`
  - Go package option: `github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1`
  - `Empty` message as placeholder

### Task 3: Add protobuf code generation targets
- Added `proto-tools` target to `server/public/Makefile`:
  - Installs `protoc-gen-go@v1.36.6`
  - Installs `protoc-gen-go-grpc@v1.5.1`
  - Versions pinned to match existing go.mod dependencies
- Added `proto-gen` target:
  - Checks for protoc availability with clear error message
  - Generates Go code from all `.proto` files
  - Uses explicit `--plugin` flags to reference GOBIN-installed tools

### Task 4: Verification
- `make proto-gen` runs successfully and is repeatable
- Generated `bootstrap.pb.go` compiles correctly
- `go build ./...` and `go test ./...` pass in `server/public`

## Commits

| Task | Commit Hash |
|------|-------------|
| Proto structure + bootstrap.proto | 2e61b0e626 |
| Makefile proto-gen targets | 2243fbbe74 |

## Files Modified

- `server/public/pluginapi/grpc/proto/bootstrap.proto` (new)
- `server/public/pluginapi/grpc/generated/go/pluginapiv1/bootstrap.pb.go` (generated)
- `server/public/Makefile` (updated)

## Deviations

- **[Rule 3: Auto-fix blocker]** Added `--plugin=protoc-gen-go=$(GOBIN)/protoc-gen-go` and `--plugin=protoc-gen-go-grpc=$(GOBIN)/protoc-gen-go-grpc` flags to the protoc command. This was necessary because protoc could not find the plugins in PATH even though they were installed in GOBIN. Without explicit plugin paths, proto-gen would fail.

## Notes

- The `test-public` Make target has an unrelated issue with gotestsum installation (Go version compatibility with golang.org/x/tools@v0.11.0), but direct `go build ./...` and `go test ./...` commands work correctly
- Proto package uses `mattermost.pluginapi.v1` namespace for versioning flexibility
- Go package places generated code in `pluginapiv1` subdirectory to avoid import path conflicts

## Verification Commands

```bash
# From server/ directory
make proto-gen          # Generate Go code from proto files
make proto-tools        # Install proto codegen tools only

# Direct verification
cd server/public && go build ./...
cd server/public && go test ./...
```
