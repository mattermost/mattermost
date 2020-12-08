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

package global

import (
	"go.opentelemetry.io/otel/api/global/internal"
	"go.opentelemetry.io/otel/api/trace"
)

// Tracer creates a named tracer that implements Tracer interface.
// If the name is an empty string then provider uses default name.
//
// This is short for TraceProvider().Tracer(name)
func Tracer(name string) trace.Tracer {
	return TraceProvider().Tracer(name)
}

// TraceProvider returns the registered global trace provider.
// If none is registered then an instance of trace.NoopProvider is returned.
//
// Use the trace provider to create a named tracer. E.g.
//     tracer := global.TraceProvider().Tracer("example.com/foo")
// or
//     tracer := global.Tracer("example.com/foo")
func TraceProvider() trace.Provider {
	return internal.TraceProvider()
}

// SetTraceProvider registers `tp` as the global trace provider.
func SetTraceProvider(tp trace.Provider) {
	internal.SetTraceProvider(tp)
}
