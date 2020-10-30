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

package trace

import (
	"context"
	"encoding/hex"
	"fmt"
	"regexp"

	"go.opentelemetry.io/otel/api/propagation"
)

const (
	supportedVersion  = 0
	maxVersion        = 254
	traceparentHeader = "traceparent"
	tracestateHeader  = "tracestate"
)

type traceContextPropagatorKeyType uint

const (
	tracestateKey traceContextPropagatorKeyType = 0
)

// TraceContext propagates SpanContext in W3C TraceContext format.
//nolint:golint
type TraceContext struct{}

var _ propagation.HTTPPropagator = TraceContext{}
var traceCtxRegExp = regexp.MustCompile("^(?P<version>[0-9a-f]{2})-(?P<traceID>[a-f0-9]{32})-(?P<spanID>[a-f0-9]{16})-(?P<traceFlags>[a-f0-9]{2})(?:-.*)?$")

// DefaultHTTPPropagator returns the default trace HTTP propagator.
func DefaultHTTPPropagator() propagation.HTTPPropagator {
	return TraceContext{}
}

func (TraceContext) Inject(ctx context.Context, supplier propagation.HTTPSupplier) {
	tracestate := ctx.Value(tracestateKey)
	if state, ok := tracestate.(string); tracestate != nil && ok {
		supplier.Set(tracestateHeader, state)
	}

	sc := SpanFromContext(ctx).SpanContext()
	if !sc.IsValid() {
		return
	}
	h := fmt.Sprintf("%.2x-%s-%s-%.2x",
		supportedVersion,
		sc.TraceID,
		sc.SpanID,
		sc.TraceFlags&FlagsSampled)
	supplier.Set(traceparentHeader, h)
}

func (tc TraceContext) Extract(ctx context.Context, supplier propagation.HTTPSupplier) context.Context {
	state := supplier.Get(tracestateHeader)
	if state != "" {
		ctx = context.WithValue(ctx, tracestateKey, state)
	}

	sc := tc.extract(supplier)
	if !sc.IsValid() {
		return ctx
	}
	return ContextWithRemoteSpanContext(ctx, sc)
}

func (TraceContext) extract(supplier propagation.HTTPSupplier) SpanContext {
	h := supplier.Get(traceparentHeader)
	if h == "" {
		return EmptySpanContext()
	}

	matches := traceCtxRegExp.FindStringSubmatch(h)

	if len(matches) == 0 {
		return EmptySpanContext()
	}

	if len(matches) < 5 { // four subgroups plus the overall match
		return EmptySpanContext()
	}

	if len(matches[1]) != 2 {
		return EmptySpanContext()
	}
	ver, err := hex.DecodeString(matches[1])
	if err != nil {
		return EmptySpanContext()
	}
	version := int(ver[0])
	if version > maxVersion {
		return EmptySpanContext()
	}

	if version == 0 && len(matches) != 5 { // four subgroups plus the overall match
		return EmptySpanContext()
	}

	if len(matches[2]) != 32 {
		return EmptySpanContext()
	}

	var sc SpanContext

	sc.TraceID, err = IDFromHex(matches[2][:32])
	if err != nil {
		return EmptySpanContext()
	}

	if len(matches[3]) != 16 {
		return EmptySpanContext()
	}
	sc.SpanID, err = SpanIDFromHex(matches[3])
	if err != nil {
		return EmptySpanContext()
	}

	if len(matches[4]) != 2 {
		return EmptySpanContext()
	}
	opts, err := hex.DecodeString(matches[4])
	if err != nil || len(opts) < 1 || (version == 0 && opts[0] > 2) {
		return EmptySpanContext()
	}
	// Clear all flags other than the trace-context supported sampling bit.
	sc.TraceFlags = opts[0] & FlagsSampled

	if !sc.IsValid() {
		return EmptySpanContext()
	}

	return sc
}

func (TraceContext) GetAllKeys() []string {
	return []string{traceparentHeader, tracestateHeader}
}
