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

// Level marks the severity of the event
type Level string

const (
	LevelDebug   Level = "debug"
	LevelInfo    Level = "info"
	LevelWarning Level = "warning"
	LevelError   Level = "error"
	LevelFatal   Level = "fatal"
)

// https://docs.sentry.io/development/sdk-dev/event-payloads/sdk/
type SdkInfo struct {
	Name         string       `json:"name,omitempty"`
	Version      string       `json:"version,omitempty"`
	Integrations []string     `json:"integrations,omitempty"`
	Packages     []SdkPackage `json:"packages,omitempty"`
}

type SdkPackage struct {
	Name    string `json:"name,omitempty"`
	Version string `json:"version,omitempty"`
}

// TODO: This type could be more useful, as map of interface{} is too generic
// and requires a lot of type assertions in beforeBreadcrumb calls
// plus it could just be `map[string]interface{}` then
type BreadcrumbHint map[string]interface{}

// https://docs.sentry.io/development/sdk-dev/event-payloads/breadcrumbs/
type Breadcrumb struct {
	Category  string                 `json:"category,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Level     Level                  `json:"level,omitempty"`
	Message   string                 `json:"message,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Type      string                 `json:"type,omitempty"`
}

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
	return json.Marshal(&struct {
		*alias
	}{
		alias: (*alias)(b),
	})
}

// https://docs.sentry.io/development/sdk-dev/event-payloads/user/
type User struct {
	Email     string `json:"email,omitempty"`
	ID        string `json:"id,omitempty"`
	IPAddress string `json:"ip_address,omitempty"`
	Username  string `json:"username,omitempty"`
}

// https://docs.sentry.io/development/sdk-dev/event-payloads/request/
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

// https://docs.sentry.io/development/sdk-dev/event-payloads/exception/
type Exception struct {
	Type          string      `json:"type,omitempty"`
	Value         string      `json:"value,omitempty"`
	Module        string      `json:"module,omitempty"`
	ThreadID      string      `json:"thread_id,omitempty"`
	Stacktrace    *Stacktrace `json:"stacktrace,omitempty"`
	RawStacktrace *Stacktrace `json:"raw_stacktrace,omitempty"`
}

type EventID string

// https://docs.sentry.io/development/sdk-dev/event-payloads/
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
}

func (e *Event) MarshalJSON() ([]byte, error) {
	type alias Event
	// encoding/json doesn't support the "omitempty" option for struct types.
	// See https://golang.org/issues/11939.
	// This implementation of MarshalJSON shadows the original Timestamp field
	// forcing it to be omitted when the Timestamp is the zero value of
	// time.Time.
	if e.Timestamp.IsZero() {
		return json.Marshal(&struct {
			*alias
			Timestamp json.RawMessage `json:"timestamp,omitempty"`
		}{
			alias: (*alias)(e),
		})
	}
	return json.Marshal(&struct {
		*alias
	}{
		alias: (*alias)(e),
	})
}

func NewEvent() *Event {
	event := Event{
		Contexts: make(map[string]interface{}),
		Extra:    make(map[string]interface{}),
		Tags:     make(map[string]string),
		Modules:  make(map[string]string),
	}
	return &event
}

type Thread struct {
	ID            string      `json:"id,omitempty"`
	Name          string      `json:"name,omitempty"`
	Stacktrace    *Stacktrace `json:"stacktrace,omitempty"`
	RawStacktrace *Stacktrace `json:"raw_stacktrace,omitempty"`
	Crashed       bool        `json:"crashed,omitempty"`
	Current       bool        `json:"current,omitempty"`
}

type EventHint struct {
	Data               interface{}
	EventID            string
	OriginalException  error
	RecoveredException interface{}
	Context            context.Context
	Request            *http.Request
	Response           *http.Response
}
