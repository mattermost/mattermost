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
	Type      string                 `json:"type,omitempty"`
	Category  string                 `json:"category,omitempty"`
	Message   string                 `json:"message,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Level     Level                  `json:"level,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// TODO: provide constants for known breadcrumb types.
// See https://develop.sentry.dev/sdk/event-payloads/breadcrumbs/#breadcrumb-types.

// MarshalJSON converts the Breadcrumb struct to JSON.
func (b *Breadcrumb) MarshalJSON() ([]byte, error) {
	// We want to omit time.Time zero values, otherwise the server will try to
	// interpret dates too far in the past. However, encoding/json doesn't
	// support the "omitempty" option for struct types. See
	// https://golang.org/issues/11939.
	//
	// We overcome the limitation and achieve what we want by shadowing fields
	// and a few type tricks.

	// breadcrumb aliases Breadcrumb to allow calling json.Marshal without an
	// infinite loop. It preserves all fields while none of the attached
	// methods.
	type breadcrumb Breadcrumb

	if b.Timestamp.IsZero() {
		return json.Marshal(struct {
			// Embed all of the fields of Breadcrumb.
			*breadcrumb
			// Timestamp shadows the original Timestamp field and is meant to
			// remain nil, triggering the omitempty behavior.
			Timestamp json.RawMessage `json:"timestamp,omitempty"`
		}{breadcrumb: (*breadcrumb)(b)})
	}
	return json.Marshal((*breadcrumb)(b))
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
	Type       string      `json:"type,omitempty"`  // used as the main issue title
	Value      string      `json:"value,omitempty"` // used as the main issue subtitle
	Module     string      `json:"module,omitempty"`
	ThreadID   string      `json:"thread_id,omitempty"`
	Stacktrace *Stacktrace `json:"stacktrace,omitempty"`
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

	// The fields below are only relevant for transactions.

	Type      string    `json:"type,omitempty"`
	StartTime time.Time `json:"start_timestamp"`
	Spans     []*Span   `json:"spans,omitempty"`
}

// TODO: Event.Contexts map[string]interface{} => map[string]EventContext,
// to prevent accidentally storing T when we mean *T.
// For example, the TraceContext must be stored as *TraceContext to pick up the
// MarshalJSON method (and avoid copying).
// type EventContext interface{ EventContext() }

// MarshalJSON converts the Event struct to JSON.
func (e *Event) MarshalJSON() ([]byte, error) {
	// We want to omit time.Time zero values, otherwise the server will try to
	// interpret dates too far in the past. However, encoding/json doesn't
	// support the "omitempty" option for struct types. See
	// https://golang.org/issues/11939.
	//
	// We overcome the limitation and achieve what we want by shadowing fields
	// and a few type tricks.
	if e.Type == transactionType {
		return e.transactionMarshalJSON()
	}
	return e.defaultMarshalJSON()
}

func (e *Event) defaultMarshalJSON() ([]byte, error) {
	// event aliases Event to allow calling json.Marshal without an infinite
	// loop. It preserves all fields while none of the attached methods.
	type event Event

	// errorEvent is like Event with shadowed fields for customizing JSON
	// marshaling.
	type errorEvent struct {
		*event

		// Timestamp shadows the original Timestamp field. It allows us to
		// include the timestamp when non-zero and omit it otherwise.
		Timestamp json.RawMessage `json:"timestamp,omitempty"`

		// The fields below are not part of error events and only make sense to
		// be sent for transactions. They shadow the respective fields in Event
		// and are meant to remain nil, triggering the omitempty behavior.

		Type      json.RawMessage `json:"type,omitempty"`
		StartTime json.RawMessage `json:"start_timestamp,omitempty"`
		Spans     json.RawMessage `json:"spans,omitempty"`
	}

	x := errorEvent{event: (*event)(e)}
	if !e.Timestamp.IsZero() {
		b, err := e.Timestamp.MarshalJSON()
		if err != nil {
			return nil, err
		}
		x.Timestamp = b
	}
	return json.Marshal(x)
}

func (e *Event) transactionMarshalJSON() ([]byte, error) {
	// event aliases Event to allow calling json.Marshal without an infinite
	// loop. It preserves all fields while none of the attached methods.
	type event Event

	// transactionEvent is like Event with shadowed fields for customizing JSON
	// marshaling.
	type transactionEvent struct {
		*event

		// The fields below shadow the respective fields in Event. They allow us
		// to include timestamps when non-zero and omit them otherwise.

		StartTime json.RawMessage `json:"start_timestamp,omitempty"`
		Timestamp json.RawMessage `json:"timestamp,omitempty"`
	}

	x := transactionEvent{event: (*event)(e)}
	if !e.Timestamp.IsZero() {
		b, err := e.Timestamp.MarshalJSON()
		if err != nil {
			return nil, err
		}
		x.Timestamp = b
	}
	if !e.StartTime.IsZero() {
		b, err := e.StartTime.MarshalJSON()
		if err != nil {
			return nil, err
		}
		x.StartTime = b
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
	ID         string      `json:"id,omitempty"`
	Name       string      `json:"name,omitempty"`
	Stacktrace *Stacktrace `json:"stacktrace,omitempty"`
	Crashed    bool        `json:"crashed,omitempty"`
	Current    bool        `json:"current,omitempty"`
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
