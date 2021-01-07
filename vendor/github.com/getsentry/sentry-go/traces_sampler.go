package sentry

import (
	"fmt"

	"github.com/getsentry/sentry-go/internal/crypto/randutil"
)

// A TracesSampler makes sampling decisions for spans.
//
// In addition to the sampling context passed to the Sample method,
// implementations may keep and use internal state to make decisions.
//
// Sampling is one of the last steps when starting a new span, such that the
// sampler can inspect most of the state of the span to make a decision.
//
// Implementations must be safe for concurrent use by multiple goroutines.
type TracesSampler interface {
	Sample(ctx SamplingContext) Sampled
}

// Implementation note:
//
// TracesSampler.Sample return type is Sampled (instead of bool or float64), so
// that we can compose samplers by letting a sampler return SampledUndefined to
// defer the decision to the next sampler.
//
// For example, a hypothetical InheritFromParentSampler would return
// SampledUndefined if there is no parent span in the SamplingContext, deferring
// the sampling decision to another sampler, like a UniformSampler.
//
// var _ TracesSampler = sentry.TracesSamplers{
// 	sentry.InheritFromParentSampler,
// 	sentry.UniformTracesSampler(0.1),
// }
//
// Another example, we can provide a sampler that returns SampledFalse if the
// SamplingContext matches some condition, and SampledUndefined otherwise:
//
// var _ TracesSampler = sentry.TracesSamplers{
// 	sentry.IgnoreTransaction(regexp.MustCompile(`^\w+ /(favicon.ico|healthz)`),
// 	sentry.InheritFromParentSampler,
// 	sentry.UniformTracesSampler(0.1),
// }
//
// If after running all samplers the decision is still undefined, the
// span/transaction is not sampled.

// A SamplingContext is passed to a TracesSampler to determine a sampling
// decision.
type SamplingContext struct {
	Span   *Span // The current span, always non-nil.
	Parent *Span // The parent span, may be nil.
}

// TODO(tracing): possibly expand SamplingContext to include custom /
// user-provided data.
//
// Unlike in other SDKs, the current http.Request is not part of the
// SamplingContext to avoid bloating it with possibly unnecessary values that
// could confuse people or have negative performance consequences.
//
// For the request to be provided in a SamplingContext, a request pointer would
// most likely need to be stored in the span context and it would open precedent
// for more arbitrary data like fasthttp.Request.
//
// Users wanting to influence the sampling decision based on the request can
// still do so, either by updating the transaction directly on their HTTP
// handler:
//
//	func(w http.ResponseWriter, r *http.Request) {
//		transaction := sentry.TransactionFromContext(r.Context())
//		if r.Header.Get("X-Custom-Sampling") == "yes" {
//			transaction.Sampled = sentry.SampledTrue
//		} else {
//			transaction.Sampled = sentry.SampledFalse
//		}
//	}
//
// Or by having their own middleware that stores arbitrary data in the request
// context (a pointer to the request itself included):
//
//	type myContextKey struct{}
//	type myContextData struct {
//		request *http.Request
//		// ...
//	}
//
//	func middleware(h http.Handler) http.Handler {
//		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
//			data := &myContextData{
//				request: r,
//			}
//			ctx := context.WithValue(r.Context(), myContextKey{}, data)
//			h.ServeHTTP(w, r.WithContext(ctx))
//		})
//	}
//
//	func main() {
//		err := sentry.Init(sentry.ClientOptions{
//			// A custom TracesSampler can access data from the span's context:
//			TracesSampler: sentry.TracesSamplerFunc(func(ctx sentry.SamplingContext) bool {
//				data, ok := ctx.Span.Context().Value(myContextKey{}).(*myContextData)
//				if !ok {
//					return false
//				}
//				return data.request.URL.Hostname() == "example.com"
//			}),
//		})
//		// ...
//	}
//
// Note, however, that for the middleware to be effective, it would have to run
// before sentryhttp's own middleware, meaning the middleware itself is not
// instrumented to send panics to Sentry and it is not part of the timed
// transaction.
//
// If neither of those prove to be sufficient, we can consider including a
// (possibly nil) *http.Request field to SamplingContext. In that case, the SDK
// would need to track the request either in the Scope or the Span.Context.
//
// Alternatively, add a map-like type or simply a generic interface{} similar to
// the CustomSamplingContext type in the Java SDK:
//
//	type SamplingContext struct {
//		Span       *Span // The current span, always non-nil.
//		Parent     *Span // The parent span, may be nil.
//		CustomData interface{}
//	}
//
//	func CustomSamplingContext(data interface{}) SpanOption {
//		return func(s *Span) {
//			s.customSamplingContext = data
//		}
//	}
//
//	func main() {
//		// ...
//		span := sentry.StartSpan(ctx, "op", CustomSamplingContext(data))
//		// ...
//	}

// The TracesSamplerFunc type is an adapter to allow the use of ordinary
// functions as a TracesSampler.
type TracesSamplerFunc func(ctx SamplingContext) Sampled

var _ TracesSampler = TracesSamplerFunc(nil)

func (f TracesSamplerFunc) Sample(ctx SamplingContext) Sampled {
	return f(ctx)
}

// UniformTracesSampler is a TracesSampler that samples root spans randomly at a
// uniform rate.
type UniformTracesSampler float64

var _ TracesSampler = UniformTracesSampler(0)

func (s UniformTracesSampler) Sample(ctx SamplingContext) Sampled {
	if s < 0.0 || s > 1.0 {
		panic(fmt.Errorf("sampling rate out of range [0.0, 1.0]: %f", s))
	}
	if randutil.Float64() < float64(s) {
		return SampledTrue
	}
	return SampledFalse
}

// TODO(tracing): implement and export basic TracesSampler implementations:
// parent-based, span ID / trace ID based, etc. It should be possible to compose
// parent-based with other samplers.
