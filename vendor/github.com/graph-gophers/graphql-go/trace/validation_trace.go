package trace

import (
	"context"

	"github.com/graph-gophers/graphql-go/errors"
)

type TraceValidationFinishFunc = TraceQueryFinishFunc

// Deprecated: use ValidationTracerContext.
type ValidationTracer interface {
	TraceValidation() TraceValidationFinishFunc
}

type ValidationTracerContext interface {
	TraceValidation(ctx context.Context) TraceValidationFinishFunc
}

type NoopValidationTracer struct{}

// Deprecated: use a Tracer which implements ValidationTracerContext.
func (NoopValidationTracer) TraceValidation() TraceValidationFinishFunc {
	return func(errs []*errors.QueryError) {}
}
