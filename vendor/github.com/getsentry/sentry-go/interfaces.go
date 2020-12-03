package sentry

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"
)

// Protocol Docs (kinda)
// https://github.com/getsentry/rust-sentry-types/blob/master/src/protocol/v7.rs

// transactionType is the type of a transaction event.
const transactionType = "transaction"

// Level marks the severity of the event.
type Level string

// Describes the severity of the event.
const (
	LevelDebug   Level = "debug"
	LevelInfo    Level = "info"
	LevelWarning Level = "warning"
	LevelError   Level = "error"
	LevelFatal   Level = "fatal"
)

// SdkInfo contains all metadata about about the SDK being used.
type SdkInfo struct {
	Name         string       `json:"name,omitempty"`
	Version      string       `json:"version,omitempty"`
	Integrations []string     `json:"integrations,omitempty"`
	Packages     []SdkPackage `json:"packages,omitempty"`
}

// SdkPackage describes a package that was installed.
type SdkPackage struct {
	Name    string `json:"name,omitempty"`
	Version string `json:"version,omitempty"`
}

// TODO: This type could be more useful, as map of interface{} is too generic
// and requires a lot of type assertions in beforeBreadcrumb calls
// plus it could just be map[string]interface{} then.

// BreadcrumbHint contains information that can be associated with a Breadcrumb.
type BreadcrumbHint map[string]interface{}

// Breadcrumb specifies an application event that occurred before a Sentry event.
// An event may contain one or more breadcrumbs.
type Breadcrumb struct {
	Category  string                 `json:"category,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Level     Level                  `json:"level,omitempty"`
	Message   string                 `json:"message,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Type      string                 `json:"type,omitempty"`
}

// MarshalJSON converts the Breadcrumb struct to JSON.
func (b *Breadcrumb) MarshalJSON() ([]byte, error) {
	type alias Breadcrumb
	// encoding/json doesn't support the "omitempty" option for struct types.
	// See https://golang.org/issues/11939.
	// This implementation of MarshalJSON shadows the original Timestamp field
	// forcing it to be omitted when the Timestamp is the zero value of
	// time.Time.
	if b.Timestamp.IsZero() {
		return json.Marshal(&struct {
			*alias
			Timestamp json.RawMessage `json:"timestamp,omitempty"`
		}{
			alias: (*alias)(b),
		})
	}
	return json.Marshal((*alias)(b))
}

// User describes the user associated with an Event. If this is used, at least
// an ID or an IP address should be provided.
type User struct {
	Email     string `json:"email,omitempty"`
	ID        string `json:"id,omitempty"`
	IPAddress string `json:"ip_address,omitempty"`
	Username  string `json:"username,omitempty"`
}

// Request contains information on a HTTP request related to the event.
type Request struct {
	URL         string            `json:"url,omitempty"`
	Method      string            `json:"method,omitempty"`
	Data        string            `json:"data,omitempty"`
	QueryString string            `json:"query_string,omitempty"`
	Cookies     string            `json:"cookies,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Env         map[string]string `json:"env,omitempty"`
}

// NewRequest returns a new Sentry Request from the given http.Request.
//
// NewRequest avoids operations that depend on network access. In particular, it
// does not read r.Body.
func NewRequest(r *http.Request) *Request {
	protocol := schemeHTTP
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		protocol = schemeHTTPS
	}
	url := fmt.Sprintf("%s://%s%s", protocol, r.Host, r.URL.Path)

	// We read only the first Cookie header because of the specification:
	// https://tools.ietf.org/html/rfc6265#section-5.4
	// When the user agent generates an HTTP request, the user agent MUST NOT
	// attach more than one Cookie header field.
	cookies := r.Header.Get("Cookie")

	headers := make(map[string]string, len(r.Header))
	for k, v := range r.Header {
		headers[k] = strings.Join(v, ",")
	}
	headers["Host"] = r.Host

	var env map[string]string
	if addr, port, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		env = map[string]string{"REMOTE_ADDR": addr, "REMOTE_PORT": port}
	}

	return &Request{
		URL:         url,
		Method:      r.Method,
		QueryString: r.URL.RawQuery,
		Cookies:     cookies,
		Headers:     headers,
		Env:         env,
	}
}

// Exception specifies an error that occurred.
type Exception struct {
	Type          string      `json:"type,omitempty"`
	Value         string      `json:"value,omitempty"`
	Module        string      `json:"module,omitempty"`
	ThreadID      string      `json:"thread_id,omitempty"`
	Stacktrace    *Stacktrace `json:"stacktrace,omitempty"`
	RawStacktrace *Stacktrace `json:"raw_stacktrace,omitempty"`
}

// EventID is a hexadecimal string representing a unique uuid4 for an Event.
// An EventID must be 32 characters long, lowercase and not have any dashes.
type EventID string

// Event is the fundamental data structure that is sent to Sentry.
type Event struct {
	Breadcrumbs []*Breadcrumb          `json:"breadcrumbs,omitempty"`
	Contexts    map[string]interface{} `json:"contexts,omitempty"`
	Dist        string                 `json:"dist,omitempty"`
	Environment string                 `json:"environment,omitempty"`
	EventID     EventID                `json:"event_id,omitempty"`
	Extra       map[string]interface{} `json:"extra,omitempty"`
	Fingerprint []string               `json:"fingerprint,omitempty"`
	Level       Level                  `json:"level,omitempty"`
	Message     string                 `json:"message,omitempty"`
	Platform    string                 `json:"platform,omitempty"`
	Release     string                 `json:"release,omitempty"`
	Sdk         SdkInfo                `json:"sdk,omitempty"`
	ServerName  string                 `json:"server_name,omitempty"`
	Threads     []Thread               `json:"threads,omitempty"`
	Tags        map[string]string      `json:"tags,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	Transaction string                 `json:"transaction,omitempty"`
	User        User                   `json:"user,omitempty"`
	Logger      string                 `json:"logger,omitempty"`
	Modules     map[string]string      `json:"modules,omitempty"`
	Request     *Request               `json:"request,omitempty"`
	Exception   []Exception            `json:"exception,omitempty"`

	// Experimental: This is part of a beta feature of the SDK. The fields below
	// are only relevant for transactions.
	Type           string    `json:"type,omitempty"`
	StartTimestamp time.Time `json:"start_timestamp"`
	Spans          []*Span   `json:"spans,omitempty"`
}

// MarshalJSON converts the Event struct to JSON.
func (e *Event) MarshalJSON() ([]byte, error) {
	// event aliases Event to allow calling json.Marshal without an infinite
	// loop. It preserves all fields of Event while none of the attached
	// methods.
	type event Event

	// Transactions are marshaled in the standard way how json.Marshal works.
	if e.Type == transactionType {
		return json.Marshal((*event)(e))
	}

	// errorEvent is like Event with some shadowed fields for customizing the
	// JSON serialization of regular "error events".
	type errorEvent struct {
		*event

		// encoding/json doesn't support the omitempty option for struct types.
		// See https://golang.org/issues/11939.
		// We shadow the original Event.Timestamp field with a json.RawMessage.
		// This allows us to include the timestamp when non-zero and omit it
		// otherwise.
		Timestamp json.RawMessage `json:"timestamp,omitempty"`

		// The fields below are not part of the regular "error events" and only
		// make sense to be sent for transactions. They shadow the respective
		// fields in Event and are meant to remain nil, triggering the omitempty
		// behavior.
		Type           json.RawMessage `json:"type,omitempty"`
		StartTimestamp json.RawMessage `json:"start_timestamp,omitempty"`
		Spans          json.RawMessage `json:"spans,omitempty"`
	}

	x := &errorEvent{event: (*event)(e)}
	if !e.Timestamp.IsZero() {
		x.Timestamp = append(x.Timestamp, '"')
		x.Timestamp = e.Timestamp.UTC().AppendFormat(x.Timestamp, time.RFC3339Nano)
		x.Timestamp = append(x.Timestamp, '"')
	}
	return json.Marshal(x)
}

// NewEvent creates a new Event.
func NewEvent() *Event {
	event := Event{
		Contexts: make(map[string]interface{}),
		Extra:    make(map[string]interface{}),
		Tags:     make(map[string]string),
		Modules:  make(map[string]string),
	}
	return &event
}

// Thread specifies threads that were running at the time of an event.
type Thread struct {
	ID            string      `json:"id,omitempty"`
	Name          string      `json:"name,omitempty"`
	Stacktrace    *Stacktrace `json:"stacktrace,omitempty"`
	RawStacktrace *Stacktrace `json:"raw_stacktrace,omitempty"`
	Crashed       bool        `json:"crashed,omitempty"`
	Current       bool        `json:"current,omitempty"`
}

// EventHint contains information that can be associated with an Event.
type EventHint struct {
	Data               interface{}
	EventID            string
	OriginalException  error
	RecoveredException interface{}
	Context            context.Context
	Request            *http.Request
	Response           *http.Response
}

// TraceContext describes the context of the trace.
//
// Experimental: This is part of a beta feature of the SDK.
type TraceContext struct {
	TraceID     string `json:"trace_id"`
	SpanID      string `json:"span_id"`
	Op          string `json:"op,omitempty"`
	Description string `json:"description,omitempty"`
	Status      string `json:"status,omitempty"`
}

// Span describes a timed unit of work in a trace.
//
// Experimental: This is part of a beta feature of the SDK.
type Span struct {
	TraceID        string                 `json:"trace_id"`
	SpanID         string                 `json:"span_id"`
	ParentSpanID   string                 `json:"parent_span_id,omitempty"`
	Op             string                 `json:"op,omitempty"`
	Description    string                 `json:"description,omitempty"`
	Status         string                 `json:"status,omitempty"`
	Tags           map[string]string      `json:"tags,omitempty"`
	StartTimestamp time.Time              `json:"start_timestamp"`
	EndTimestamp   time.Time              `json:"timestamp"`
	Data           map[string]interface{} `json:"data,omitempty"`
}
