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
	"log"
	"os"
	"sync"
	"sync/atomic"

	"go.opentelemetry.io/otel"
)

var (
	// globalErrorHandler provides an ErrorHandler that can be used
	// throughout an OpenTelemetry instrumented project. When a user
	// specified ErrorHandler is registered (`SetErrorHandler`) all calls to
	// `Handle` and will be delegated to the registered ErrorHandler.
	globalErrorHandler = &loggingErrorHandler{
		l: log.New(os.Stderr, "", log.LstdFlags),
	}

	// delegateErrorHandlerOnce ensures that a user provided ErrorHandler is
	// only ever registered once.
	delegateErrorHandlerOnce sync.Once

	// Comiple time check that loggingErrorHandler implements ErrorHandler.
	_ otel.ErrorHandler = (*loggingErrorHandler)(nil)
)

// loggingErrorHandler logs all errors to STDERR.
type loggingErrorHandler struct {
	delegate atomic.Value

	l *log.Logger
}

// setDelegate sets the ErrorHandler delegate if one is not already set.
func (h *loggingErrorHandler) setDelegate(d otel.ErrorHandler) {
	if h.delegate.Load() != nil {
		// Delegate already registered
		return
	}
	h.delegate.Store(d)
}

// Handle implements otel.ErrorHandler.
func (h *loggingErrorHandler) Handle(err error) {
	if d := h.delegate.Load(); d != nil {
		d.(otel.ErrorHandler).Handle(err)
		return
	}
	h.l.Print(err)
}

// ErrorHandler returns the global ErrorHandler instance. If no ErrorHandler
// instance has been set (`SetErrorHandler`), the default ErrorHandler which
// logs errors to STDERR is returned.
func ErrorHandler() otel.ErrorHandler {
	return globalErrorHandler
}

// SetErrorHandler sets the global ErrorHandler to be h.
func SetErrorHandler(h otel.ErrorHandler) {
	delegateErrorHandlerOnce.Do(func() {
		current := ErrorHandler()
		if current == h {
			return
		}
		if internalHandler, ok := current.(*loggingErrorHandler); ok {
			internalHandler.setDelegate(h)
		}
	})
}

// Handle is a convience function for ErrorHandler().Handle(err)
func Handle(err error) {
	ErrorHandler().Handle(err)
}
