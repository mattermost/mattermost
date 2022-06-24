// Package noop defines a no-op tracer implementation.
package noop

import (
	"context"

	"github.com/graph-gophers/graphql-go/errors"
	"github.com/graph-gophers/graphql-go/introspection"
)

// Tracer is a no-op tracer that does nothing.
type Tracer struct{}

func (Tracer) TraceQuery(ctx context.Context, queryString string, operationName string, variables map[string]interface{}, varTypes map[string]*introspection.Type) (context.Context, func([]*errors.QueryError)) {
	return ctx, func(errs []*errors.QueryError) {}
}

func (Tracer) TraceField(ctx context.Context, label, typeName, fieldName string, trivial bool, args map[string]interface{}) (context.Context, func(*errors.QueryError)) {
	return ctx, func(err *errors.QueryError) {}
}

func (Tracer) TraceValidation(context.Context) func([]*errors.QueryError) {
	return func(errs []*errors.QueryError) {}
}
