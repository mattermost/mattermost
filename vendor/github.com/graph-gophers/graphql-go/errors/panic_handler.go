package errors

import (
	"context"
)

// PanicHandler is the interface used to create custom panic errors that occur during query execution
type PanicHandler interface {
	MakePanicError(ctx context.Context, value interface{}) *QueryError
}

// DefaultPanicHandler is the default PanicHandler
type DefaultPanicHandler struct{}

// MakePanicError creates a new QueryError from a panic that occurred during execution
func (h *DefaultPanicHandler) MakePanicError(ctx context.Context, value interface{}) *QueryError {
	return Errorf("panic occurred: %v", value)
}
