package sentry

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// A Span is the building block of a Sentry transaction. Spans build up a tree
// structure of timed operations. The span tree makes up a transaction event
// that is sent to Sentry when the root span is finished.
//
// Spans must be started with either StartSpan or Span.StartChild.
type Span struct { //nolint: maligned // prefer readability over optimal memory layout (see note below *)
	TraceID      TraceID                `json:"trace_id"`
	SpanID       SpanID                 `json:"span_id"`
	ParentSpanID SpanID                 `json:"parent_span_id"`
	Op           string                 `json:"op,omitempty"`
	Description  string                 `json:"description,omitempty"`
	Status       SpanStatus             `json:"status,omitempty"`
	Tags         map[string]string      `json:"tags,omitempty"`
	StartTime    time.Time              `json:"start_timestamp"`
	EndTime      time.Time              `json:"timestamp"`
	Data         map[string]interface{} `json:"data,omitempty"`

	Sampled Sampled `json:"-"`

	// ctx is the context where the span was started. Always non-nil.
	ctx context.Context

	// parent refers to the immediate local parent span. A remote parent span is
	// only referenced by setting ParentSpanID.
	parent *Span

	// isTransaction is true only for the root span of a local span tree. The
	// root span is the first span started in a context. Note that a local root
	// span may have a remote parent belonging to the same trace, therefore
	// isTransaction depends on ctx and not on parent.
	isTransaction bool

	// recorder stores all spans in a transaction. Guaranteed to be non-nil.
	recorder *spanRecorder
}

// (*) Note on maligned:
//
// We prefer readability over optimal memory layout. If we ever decide to
// reorder fields, we can use a tool:
//
// go run honnef.co/go/tools/cmd/structlayout -json . Span | go run honnef.co/go/tools/cmd/structlayout-optimize
//
// Other structs would deserve reordering as well, for example Event.

// TODO: make Span.Tags and Span.Data opaque types (struct{unexported []slice}).
// An opaque type allows us to add methods and make it more convenient to use
// than maps, because maps require careful nil checks to use properly or rely on
// explicit initialization for every span, even when there might be no
// tags/data. For Span.Data, must gracefully handle values that cannot be
// marshaled into JSON (see transport.go:getRequestBodyFromEvent).

// StartSpan starts a new span to describe an operation. The new span will be a
// child of the last span stored in ctx, if any.
//
// One or more options can be used to modify the span properties. Typically one
// option as a function literal is enough. Combining multiple options can be
// useful to define and reuse specific properties with named functions.
//
// Caller should call the Finish method on the span to mark its end. Finishing a
// root span sends the span and all of its children, recursively, as a
// transaction to Sentry.
func StartSpan(ctx context.Context, operation string, options ...SpanOption) *Span {
	parent, hasParent := ctx.Value(spanContextKey{}).(*Span)
	var span Span
	span = Span{
		// defaults
		Op:        operation,
		StartTime: time.Now(),

		ctx:           context.WithValue(ctx, spanContextKey{}, &span),
		parent:        parent,
		isTransaction: !hasParent,
	}
	if hasParent {
		span.TraceID = parent.TraceID
	} else {
		// Implementation note:
		//
		// While math/rand is ~2x faster than crypto/rand (exact
		// difference depends on hardware / OS), crypto/rand is probably
		// fast enough and a safer choice.
		//
		// For reference, OpenTelemetry [1] uses crypto/rand to seed
		// math/rand. AFAICT this approach does not preserve the
		// properties from crypto/rand that make it suitable for
		// cryptography. While it might be debatable whether those
		// properties are important for us here, again, we're taking the
		// safer path.
		//
		// See [2a] & [2b] for a discussion of some of the properties we
		// obtain by using crypto/rand and [3a] & [3b] for why we avoid
		// math/rand.
		//
		// Because the math/rand seed has only 64 bits (int64), if the
		// first thing we do after seeding an RNG is to read in a random
		// TraceID, there are only 2^64 possible values. Compared to
		// UUID v4 that have 122 random bits, there is a much greater
		// chance of collision [4a] & [4b].
		//
		// [1]:  https://github.com/open-telemetry/opentelemetry-go/blob/958041ddf619a128/sdk/trace/trace.go#L25-L31
		// [2a]: https://security.stackexchange.com/q/120352/246345
		// [2b]: https://security.stackexchange.com/a/120365/246345
		// [3a]: https://github.com/golang/go/issues/11871#issuecomment-126333686
		// [3b]: https://github.com/golang/go/issues/11871#issuecomment-126357889
		// [4a]: https://en.wikipedia.org/wiki/Universally_unique_identifier#Collisions
		// [4b]: https://www.wolframalpha.com/input/?i=sqrt%282*2%5E64*ln%281%2F%281-0.5%29%29%29
		_, err := rand.Read(span.TraceID[:])
		if err != nil {
			panic(err)
		}
	}
	_, err := rand.Read(span.SpanID[:])
	if err != nil {
		panic(err)
	}
	if hasParent {
		span.ParentSpanID = parent.SpanID
	}

	// Apply options to override defaults.
	for _, option := range options {
		option(&span)
	}

	span.Sampled = span.sample()

	if hasParent {
		span.recorder = parent.spanRecorder()
	} else {
		span.recorder = &spanRecorder{}
	}
	span.recorder.record(&span)

	// Update scope so that all events include a trace context, allowing
	// Sentry to correlate errors to transactions/spans.
	hubFromContext(ctx).Scope().SetContext("trace", span.traceContext())

	return &span
}

// Finish sets the span's end time, unless already set. If the span is the root
// of a span tree, Finish sends the span tree to Sentry as a transaction.
func (s *Span) Finish() {
	// TODO(tracing): maybe make Finish run at most once, such that
	// (incorrectly) calling it twice never double sends to Sentry.

	if s.EndTime.IsZero() {
		s.EndTime = monotonicTimeSince(s.StartTime)
	}
	if !s.Sampled.Bool() {
		return
	}
	event := s.toEvent()
	if event == nil {
		return
	}

	// TODO(tracing): add breadcrumbs
	// (see https://github.com/getsentry/sentry-python/blob/f6f3525f8812f609/sentry_sdk/tracing.py#L372)

	hub := hubFromContext(s.ctx)
	if hub.Scope().Transaction() == "" {
		Logger.Printf("Missing transaction name for span with op = %q", s.Op)
	}
	hub.CaptureEvent(event)
}

// Context returns the context containing the span.
func (s *Span) Context() context.Context { return s.ctx }

// StartChild starts a new child span.
//
// The call span.StartChild(operation, options...) is a shortcut for
// StartSpan(span.Context(), operation, options...).
func (s *Span) StartChild(operation string, options ...SpanOption) *Span {
	return StartSpan(s.Context(), operation, options...)
}

// SetTag sets a tag on the span. It is recommended to use SetTag instead of
// accessing the tags map directly as SetTag takes care of initializing the map
// when necessary.
func (s *Span) SetTag(name, value string) {
	if s.Tags == nil {
		s.Tags = make(map[string]string)
	}
	s.Tags[name] = value
}

// TODO(tracing): maybe add shortcuts to get/set transaction name. Right now the
// transaction name is in the Scope, as it has existed there historically, prior
// to tracing.
//
// See Scope.Transaction() and Scope.SetTransaction().
//
// func (s *Span) TransactionName() string
// func (s *Span) SetTransactionName(name string)

// ToSentryTrace returns the trace propagation value used with the sentry-trace
// HTTP header.
func (s *Span) ToSentryTrace() string {
	// TODO(tracing): add instrumentation for outgoing HTTP requests using
	// ToSentryTrace.
	var b strings.Builder
	fmt.Fprintf(&b, "%s-%s", s.TraceID.Hex(), s.SpanID.Hex())
	switch s.Sampled {
	case SampledTrue:
		b.WriteString("-1")
	case SampledFalse:
		b.WriteString("-0")
	}
	return b.String()
}

// sentryTracePattern matches either
//
// 	TRACE_ID - SPAN_ID
// 	[[:xdigit:]]{32}-[[:xdigit:]]{16}
//
// or
//
// 	TRACE_ID - SPAN_ID - SAMPLED
// 	[[:xdigit:]]{32}-[[:xdigit:]]{16}-[01]
var sentryTracePattern = regexp.MustCompile(`^([[:xdigit:]]{32})-([[:xdigit:]]{16})(?:-([01]))?$`)

// updateFromSentryTrace parses a sentry-trace HTTP header (as returned by
// ToSentryTrace) and updates fields of the span. If the header cannot be
// recognized as valid, the span is left unchanged.
func (s *Span) updateFromSentryTrace(header []byte) {
	m := sentryTracePattern.FindSubmatch(header)
	if m == nil {
		// no match
		return
	}
	_, _ = hex.Decode(s.TraceID[:], m[1])
	_, _ = hex.Decode(s.ParentSpanID[:], m[2])
	if len(m[3]) != 0 {
		switch m[3][0] {
		case '0':
			s.Sampled = SampledFalse
		case '1':
			s.Sampled = SampledTrue
		}
	}
}

func (s *Span) MarshalJSON() ([]byte, error) {
	// span aliases Span to allow calling json.Marshal without an infinite loop.
	// It preserves all fields while none of the attached methods.
	type span Span
	var parentSpanID string
	if s.ParentSpanID != zeroSpanID {
		parentSpanID = s.ParentSpanID.String()
	}
	return json.Marshal(struct {
		*span
		ParentSpanID string `json:"parent_span_id,omitempty"`
	}{
		span:         (*span)(s),
		ParentSpanID: parentSpanID,
	})
}

func (s *Span) sample() Sampled {
	// https://develop.sentry.dev/sdk/unified-api/tracing/#sampling
	// #1 explicit sampling decision via StartSpan options.
	if s.Sampled != SampledUndefined {
		return s.Sampled
	}
	hub := hubFromContext(s.ctx)
	var clientOptions ClientOptions
	client := hub.Client()
	if client != nil {
		clientOptions = hub.Client().Options()
	}
	samplingContext := SamplingContext{Span: s, Parent: s.parent}
	// Variant for non-transaction spans: they inherit the parent decision.
	// TracesSampler only runs for the root span.
	// Note: non-transaction should always have a parent, but we check both
	// conditions anyway -- the first for semantic meaning, the second to
	// avoid a nil pointer dereference.
	if !s.isTransaction && s.parent != nil {
		return s.parent.Sampled
	}
	// #2 use TracesSampler from ClientOptions.
	sampler := clientOptions.TracesSampler
	if sampler != nil {
		return sampler.Sample(samplingContext)
	}
	// #3 inherit parent decision.
	if s.parent != nil {
		return s.parent.Sampled
	}
	// #4 uniform sampling using TracesSampleRate.
	sampler = UniformTracesSampler(clientOptions.TracesSampleRate)
	return sampler.Sample(samplingContext)
}

func (s *Span) toEvent() *Event {
	if !s.isTransaction {
		return nil // only transactions can be transformed into events
	}
	hub := hubFromContext(s.ctx)

	children := s.recorder.children()
	finished := make([]*Span, 0, len(children))
	for _, child := range children {
		if child.EndTime.IsZero() {
			Logger.Printf("Dropped unfinished span: Op=%q TraceID=%s SpanID=%s", child.Op, child.TraceID, child.SpanID)
			continue
		}
		finished = append(finished, child)
	}

	return &Event{
		Type:        transactionType,
		Transaction: hub.Scope().Transaction(),
		Contexts: map[string]interface{}{
			"trace": s.traceContext(),
		},
		Tags:      s.Tags,
		Extra:     s.Data,
		Timestamp: s.EndTime,
		StartTime: s.StartTime,
		Spans:     finished,
	}
}

func (s *Span) traceContext() *TraceContext {
	return &TraceContext{
		TraceID:      s.TraceID,
		SpanID:       s.SpanID,
		ParentSpanID: s.ParentSpanID,
		Op:           s.Op,
		Description:  s.Description,
		Status:       s.Status,
	}
}

// spanRecorder stores the span tree. Guaranteed to be non-nil.
func (s *Span) spanRecorder() *spanRecorder { return s.recorder }

// TraceID identifies a trace.
type TraceID [16]byte

func (id TraceID) Hex() []byte {
	b := make([]byte, hex.EncodedLen(len(id)))
	hex.Encode(b, id[:])
	return b
}

func (id TraceID) String() string {
	return string(id.Hex())
}

func (id TraceID) MarshalText() ([]byte, error) {
	return id.Hex(), nil
}

// SpanID identifies a span.
type SpanID [8]byte

func (id SpanID) Hex() []byte {
	b := make([]byte, hex.EncodedLen(len(id)))
	hex.Encode(b, id[:])
	return b
}

func (id SpanID) String() string {
	return string(id.Hex())
}

func (id SpanID) MarshalText() ([]byte, error) {
	return id.Hex(), nil
}

// Zero values of TraceID and SpanID used for comparisons.
var (
	zeroTraceID TraceID
	zeroSpanID  SpanID
)

// SpanStatus is the status of a span.
type SpanStatus uint8

// Implementation note:
//
// In Relay (ingestion), the SpanStatus type is an enum used as
// Annotated<SpanStatus> when embedded in structs, making it effectively
// Option<SpanStatus>. It means the status is either null or one of the known
// string values.
//
// In Snuba (search), the SpanStatus is stored as an uint8 and defaulted to 2
// ("unknown") when not set. It means that Discover searches for
// `transaction.status:unknown` return both transactions/spans with status
// `null` or `"unknown"`. Searches for `transaction.status:""` return nothing.
//
// With that in mind, the Go SDK default is SpanStatusUndefined, which is
// null/omitted when serializing to JSON, but integrations may update the status
// automatically based on contextual information.

const (
	SpanStatusUndefined SpanStatus = iota
	SpanStatusOK
	SpanStatusCanceled
	SpanStatusUnknown
	SpanStatusInvalidArgument
	SpanStatusDeadlineExceeded
	SpanStatusNotFound
	SpanStatusAlreadyExists
	SpanStatusPermissionDenied
	SpanStatusResourceExhausted
	SpanStatusFailedPrecondition
	SpanStatusAborted
	SpanStatusOutOfRange
	SpanStatusUnimplemented
	SpanStatusInternalError
	SpanStatusUnavailable
	SpanStatusDataLoss
	SpanStatusUnauthenticated
	maxSpanStatus
)

func (ss SpanStatus) String() string {
	if ss >= maxSpanStatus {
		return ""
	}
	m := [maxSpanStatus]string{
		"",
		"ok",
		"cancelled", // [sic]
		"unknown",
		"invalid_argument",
		"deadline_exceeded",
		"not_found",
		"already_exists",
		"permission_denied",
		"resource_exhausted",
		"failed_precondition",
		"aborted",
		"out_of_range",
		"unimplemented",
		"internal_error",
		"unavailable",
		"data_loss",
		"unauthenticated",
	}
	return m[ss]
}

func (ss SpanStatus) MarshalJSON() ([]byte, error) {
	s := ss.String()
	if s == "" {
		return []byte("null"), nil
	}
	return json.Marshal(s)
}

// A TraceContext carries information about an ongoing trace and is meant to be
// stored in Event.Contexts (as *TraceContext).
type TraceContext struct {
	TraceID      TraceID    `json:"trace_id"`
	SpanID       SpanID     `json:"span_id"`
	ParentSpanID SpanID     `json:"parent_span_id"`
	Op           string     `json:"op,omitempty"`
	Description  string     `json:"description,omitempty"`
	Status       SpanStatus `json:"status,omitempty"`
}

func (tc *TraceContext) MarshalJSON() ([]byte, error) {
	// traceContext aliases TraceContext to allow calling json.Marshal without
	// an infinite loop. It preserves all fields while none of the attached
	// methods.
	type traceContext TraceContext
	var parentSpanID string
	if tc.ParentSpanID != zeroSpanID {
		parentSpanID = tc.ParentSpanID.String()
	}
	return json.Marshal(struct {
		*traceContext
		ParentSpanID string `json:"parent_span_id,omitempty"`
	}{
		traceContext: (*traceContext)(tc),
		ParentSpanID: parentSpanID,
	})
}

// Sampled signifies a sampling decision.
type Sampled int8

// The possible trace sampling decisions are: SampledFalse, SampledUndefined
// (default) and SampledTrue.
const (
	SampledFalse Sampled = -1 + iota
	SampledUndefined
	SampledTrue
)

func (s Sampled) String() string {
	switch s {
	case SampledFalse:
		return "SampledFalse"
	case SampledUndefined:
		return "SampledUndefined"
	case SampledTrue:
		return "SampledTrue"
	default:
		return fmt.Sprintf("SampledInvalid(%d)", s)
	}
}

// Bool returns true if the sample decision is SampledTrue, false otherwise.
func (s Sampled) Bool() bool {
	return s == SampledTrue
}

// A SpanOption is a function that can modify the properties of a span.
type SpanOption func(s *Span)

// The TransactionName option sets the name of the current transaction.
//
// A span tree has a single transaction name, therefore using this option when
// starting a span affects the span tree as a whole, potentially overwriting a
// name set previously.
func TransactionName(name string) SpanOption {
	return func(s *Span) {
		hubFromContext(s.Context()).Scope().SetTransaction(name)
	}
}

// ContinueFromRequest returns a span option that updates the span to continue
// an existing trace. If it cannot detect an existing trace in the request, the
// span will be left unchanged.
func ContinueFromRequest(r *http.Request) SpanOption {
	return func(s *Span) {
		trace := r.Header.Get("sentry-trace")
		if trace == "" {
			return
		}
		s.updateFromSentryTrace([]byte(trace))
	}
}

// spanContextKey is used to store span values in contexts.
type spanContextKey struct{}

// TransactionFromContext returns the root span of the current transaction. It
// returns nil if no transaction is tracked in the context.
func TransactionFromContext(ctx context.Context) *Span {
	if span, ok := ctx.Value(spanContextKey{}).(*Span); ok {
		return span.recorder.root()
	}
	return nil
}

// spanFromContext returns the last span stored in the context or a dummy
// non-nil span.
//
// TODO(tracing): consider exporting this. Without this, users cannot retrieve a
// span from a context since spanContextKey is not exported.
//
// This can be added retroactively, and in the meantime think better whether it
// should return nil (like GetHubFromContext), always non-nil (like
// HubFromContext), or both: two exported functions.
//
// Note the equivalence:
//
// 	SpanFromContext(ctx).StartChild(...) === StartSpan(ctx, ...)
//
// So we don't aim spanFromContext at creating spans, but mutating existing
// spans that you'd have no access otherwise (because it was created in code you
// do not control, for example SDK auto-instrumentation).
//
// For now we provide TransactionFromContext, which solves the more common case
// of setting tags, etc, on the current transaction.
func spanFromContext(ctx context.Context) *Span {
	if span, ok := ctx.Value(spanContextKey{}).(*Span); ok {
		return span
	}
	return nil
}
