// Package sentryhttp provides Sentry integration for servers based on the
// net/http package.
package sentryhttp

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
)

// A Handler is an HTTP middleware factory that provides integration with
// Sentry.
type Handler struct {
	repanic         bool
	waitForDelivery bool
	timeout         time.Duration
}

// Options configure a Handler.
type Options struct {
	// Repanic configures whether to panic again after recovering from a panic.
	// Use this option if you have other panic handlers or want the default
	// behavior from Go's http package, as documented in
	// https://golang.org/pkg/net/http/#Handler.
	Repanic bool
	// WaitForDelivery indicates, in case of a panic, whether to block the
	// current goroutine and wait until the panic event has been reported to
	// Sentry before repanicking or resuming normal execution.
	//
	// This option is normally not needed. Unless you need different behaviors
	// for different HTTP handlers, configure the SDK to use the
	// HTTPSyncTransport instead.
	//
	// Waiting (or using HTTPSyncTransport) is useful when the web server runs
	// in an environment that interrupts execution at the end of a request flow,
	// like modern serverless platforms.
	WaitForDelivery bool
	// Timeout for the delivery of panic events. Defaults to 2s. Only relevant
	// when WaitForDelivery is true.
	//
	// If the timeout is reached, the current goroutine is no longer blocked
	// waiting, but the delivery is not canceled.
	Timeout time.Duration
}

// New returns a new Handler. Use the Handle and HandleFunc methods to wrap
// existing HTTP handlers.
func New(options Options) *Handler {
	timeout := options.Timeout
	if timeout == 0 {
		timeout = 2 * time.Second
	}
	return &Handler{
		repanic:         options.Repanic,
		timeout:         timeout,
		waitForDelivery: options.WaitForDelivery,
	}
}

// Handle works as a middleware that wraps an existing http.Handler. A wrapped
// handler will recover from and report panics to Sentry, and provide access to
// a request-specific hub to report messages and errors.
func (h *Handler) Handle(handler http.Handler) http.Handler {
	return h.handle(handler)
}

// HandleFunc is like Handle, but with a handler function parameter for cases
// where that is convenient. In particular, use it to wrap a handler function
// literal.
//
//  http.Handle(pattern, h.HandleFunc(func (w http.ResponseWriter, r *http.Request) {
//      // handler code here
//  }))
func (h *Handler) HandleFunc(handler http.HandlerFunc) http.HandlerFunc {
	return h.handle(handler)
}

func (h *Handler) handle(handler http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		hub := sentry.GetHubFromContext(ctx)
		if hub == nil {
			hub = sentry.CurrentHub().Clone()
			ctx = sentry.SetHubOnContext(ctx, hub)
		}
		span := sentry.StartSpan(ctx, "http.server",
			sentry.TransactionName(fmt.Sprintf("%s %s", r.Method, r.URL.Path)),
			sentry.ContinueFromRequest(r),
		)
		defer span.Finish()
		// TODO(tracing): if the next handler.ServeHTTP panics, store
		// information on the transaction accordingly (status, tag,
		// level?, ...).
		r = r.WithContext(span.Context())
		hub.Scope().SetRequest(r)
		defer h.recoverWithSentry(hub, r)
		// TODO(tracing): use custom response writer to intercept
		// response. Use HTTP status to add tag to transaction; set span
		// status.
		handler.ServeHTTP(w, r)
	}
}

func (h *Handler) recoverWithSentry(hub *sentry.Hub, r *http.Request) {
	if err := recover(); err != nil {
		eventID := hub.RecoverWithContext(
			context.WithValue(r.Context(), sentry.RequestContextKey, r),
			err,
		)
		if eventID != nil && h.waitForDelivery {
			hub.Flush(h.timeout)
		}
		if h.repanic {
			panic(err)
		}
	}
}
