# Phase 1 - Plan 01-03: Error Handling and RPC Envelope Conventions

## Summary

Implemented error handling types and established RPC envelope conventions for the gRPC Plugin API. This plan defines the patterns that all Phase 2 (API) and Phase 3 (Hooks) service definitions will follow.

## Decision: Error Propagation Strategy

**Chosen: Option B - Response-embedded AppError**

### Rationale
1. **Semantic Preservation**: Closest to current Go plugin API semantics where methods return `(*T, *AppError)`. All AppError fields (id, message, detailed_error, request_id, status_code, where, params) are preserved without lossy mapping to gRPC codes.
2. **Cross-Language Simplicity**: Python clients simply check if the error field is present/populated rather than parsing gRPC exceptions.
3. **Transport Layer Separation**: gRPC status codes are reserved exclusively for transport-level failures (timeouts, unavailable, connection errors), making error handling cleaner.
4. **Current System Alignment**: The existing `client_rpc.go` implementation preserves full `model.AppError` across RPC boundaries using gob encoding. Our gRPC layer maintains this fidelity.

## Discovery Findings

### L1: AppError Field Mapping

| Go Field (model.AppError) | Proto Field | Notes |
|---------------------------|-------------|-------|
| `Id string` | `string id = 1` | Error identifier for categorization |
| `Message string` | `string message = 2` | User-facing translated message |
| `DetailedError string` | `string detailed_error = 3` | Technical debugging info |
| `RequestId string` | `string request_id = 4` | Request correlation ID |
| `StatusCode int` | `int32 status_code = 5` | HTTP status code |
| `Where string` | `string where = 6` | Origin location (Struct.Func) |
| `params map[string]any` | `google.protobuf.Struct params = 7` | **NEW**: Error message interpolation params |
| `SkipTranslation bool` | *Omitted* | Internal Go field, not needed cross-language |
| `wrapped error` | *Omitted* | Internal Go error wrapping |

### L2: Error Propagation Patterns

The existing `client_rpc.go` shows:
- `encodableError()` preserves `*model.AppError` and `*pq.Error` unchanged
- Other errors are converted to `ErrorString` with special code mappings
- All API methods follow the `(*T, *model.AppError)` return pattern

## Implementation Details

### New Types Added

1. **RequestContext** - Request metadata for every RPC call
   - `plugin_id`: Logical plugin identifier from manifest
   - `request_id`: Unique ID for log correlation
   - `session_id`: Optional session identifier
   - `user_id`: Optional user identifier for auditing

2. **AppError Enhancement** - Added `params` field
   - Type: `google.protobuf.Struct` (maps to `map[string]any`)
   - Purpose: Error message variable interpolation
   - Example: `{"field": "email", "value": "invalid@"}`

### RPC Envelope Conventions (documented in proto comments)

**Request Messages:**
```protobuf
message {Method}Request {
  RequestContext context = 1;  // Required: field 1 reserved
  // Method-specific parameters as fields 2+
}
```

**Response Messages:**
```protobuf
message {Method}Response {
  AppError error = 1;          // Required: field 1 reserved (null = success)
  // Result value(s) as fields 2+
}
```

## Files Modified

| File | Changes |
|------|---------|
| `server/public/pluginapi/grpc/proto/common.proto` | Added RequestContext, params field, RPC conventions |
| `server/public/pluginapi/grpc/generated/go/pluginapiv1/common.pb.go` | Regenerated with new types |

## Verification

- `make proto-gen` - Succeeded
- `go build ./public/pluginapi/grpc/generated/go/pluginapiv1/...` - Succeeded
- Generated Go code includes all new types with correct field tags

## Commit

- `1a8f3c0c4e` - feat(01-03): add error handling and RPC envelope conventions

## Deviations

None. All tasks completed as specified in the plan.

## Success Criteria Met

- [x] Protobuf `AppError` exists with all required fields including `params`
- [x] `RequestContext` exists for consistent request metadata
- [x] Request/response conventions documented in proto file comments
- [x] Generated Go code compiles successfully
- [x] Conventions clear enough for Phase 2/3 to implement RPCs consistently

---

*Completed: 2026-01-16*
*Duration: ~30 minutes*
