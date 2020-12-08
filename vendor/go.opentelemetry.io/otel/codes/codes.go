// Copyright The OpenTelemetry Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package codes defines the canonical error codes used by OpenTelemetry.
//
// It conforms to [the OpenTelemetry
// specification](https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/trace/api.md#statuscanonicalcode).
// This also means that it follows gRPC codes and is based on
// [google.golang.org/grpc/codes](https://godoc.org/google.golang.org/grpc/codes).
//
// This package was added to this project, instead of using that existing
// package, to avoid the large package size it includes and not impose that
// burden on projects using this package.
package codes

// Code is an 32-bit representation of a status state.
type Code uint32

// WARNING: any changes here must be propagated to the
// otel/sdk/internal/codes.go file.
const (
	// OK means success.
	OK Code = 0
	// Canceled indicates the operation was canceled (typically by the
	// caller).
	Canceled Code = 1
	// Unknown error. An example of where this error may be returned is if an
	// error is raised by a dependant API that does not contain enough
	// information to convert it into a more appropriate error.
	Unknown Code = 2
	// InvalidArgument indicates a client specified an invalid argument. Note
	// that this differs from FailedPrecondition. InvalidArgument indicates
	// arguments that are problematic regardless of the state of the system.
	InvalidArgument Code = 3
	// DeadlineExceeded means a deadline expired before the operation could
	// complete. For operations that change the state of the system, this error
	// may be returned even if the operation has completed successfully.
	DeadlineExceeded Code = 4
	// NotFound means some requested entity (e.g., file or directory) was not
	// found.
	NotFound Code = 5
	// AlreadyExists means some entity that we attempted to create (e.g., file
	// or directory) already exists.
	AlreadyExists Code = 6
	// PermissionDenied means the caller does not have permission to execute
	// the specified operation. PermissionDenied must not be used if the caller
	// cannot be identified (use Unauthenticated instead for those errors).
	PermissionDenied Code = 7
	// ResourceExhausted means some resource has been exhausted, perhaps a
	// per-user quota, or perhaps the entire file system is out of space.
	ResourceExhausted Code = 8
	// FailedPrecondition means the operation was rejected because the system
	// is not in a state required for the operation's execution.
	FailedPrecondition Code = 9
	// Aborted means the operation was aborted, typically due to a concurrency
	// issue like sequencer check failures, transaction aborts, etc.
	Aborted Code = 10
	// OutOfRange means the operation was attempted past the valid range.
	// E.g., seeking or reading past end of file. Unlike InvalidArgument, this
	// error indicates a problem that may be fixed if the system state
	// changes.
	OutOfRange Code = 11
	// Unimplemented means the operation is not implemented or not
	// supported/enabled in this service.
	Unimplemented Code = 12
	// Internal means an internal errors. It means some invariants expected by
	// underlying system has been broken.
	Internal Code = 13
	// Unavailable means the service is currently unavailable. This is most
	// likely a transient condition and may be corrected by retrying with a
	// backoff.
	Unavailable Code = 14
	// DataLoss means unrecoverable data loss or corruption has occurred.
	DataLoss Code = 15
	// Unauthenticated means the request does not have valid authentication
	// credentials for the operation.
	Unauthenticated Code = 16
)
