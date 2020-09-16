package sentry

import (
	"context"
	"crypto/x509"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"os"
	"reflect"
	"sort"
	"sync"
	"time"
)

// maxErrorDepth is the maximum number of errors reported in a chain of errors.
// This protects the SDK from an arbitrarily long chain of wrapped errors.
//
// An additional consideration is that arguably reporting a long chain of errors
// is of little use when debugging production errors with Sentry. The Sentry UI
// is not optimized for long chains either. The top-level error together with a
// stack trace is often the most useful information.
const maxErrorDepth = 10

// hostname is the host name reported by the kernel. It is precomputed once to
// avoid syscalls when capturing events.
//
// The error is ignored because retrieving the host name is best-effort. If the
// error is non-nil, there is nothing to do other than retrying. We choose not
// to retry for now.
var hostname, _ = os.Hostname()

// lockedRand is a random number generator safe for concurrent use. Its API is
// intentionally limited and it is not meant as a full replacement for a
// rand.Rand.
type lockedRand struct {
	mu sync.Mutex
	r  *rand.Rand
}

// Float64 returns a pseudo-random number in [0.0,1.0).
func (r *lockedRand) Float64() float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.r.Float64()
}

// rng is the internal random number generator.
//
// We do not use the global functions from math/rand because, while they are
// safe for concurrent use, any package in a build could change the seed and
// affect the generated numbers, for instance making them deterministic. On the
// other hand, the source returned from rand.NewSource is not safe for
// concurrent use, so we need to couple its use with a sync.Mutex.
var rng = &lockedRand{
	r: rand.New(rand.NewSource(time.Now().UnixNano())),
}

// usageError is used to report to Sentry an SDK usage error.
//
// It is not exported because it is never returned by any function or method in
// the exported API.
type usageError struct {
	error
}

// Logger is an instance of log.Logger that is use to provide debug information about running Sentry Client
// can be enabled by either using Logger.SetOutput directly or with Debug client option.
var Logger = log.New(ioutil.Discard, "[Sentry] ", log.LstdFlags)

// EventProcessor is a function that processes an event.
// Event processors are used to change an event before it is sent to Sentry.
type EventProcessor func(event *Event, hint *EventHint) *Event

// EventModifier is the interface that wraps the ApplyToEvent method.
//
// ApplyToEvent changes an event based on external data and/or
// an event hint.
type EventModifier interface {
	ApplyToEvent(event *Event, hint *EventHint) *Event
}

var globalEventProcessors []EventProcessor

// AddGlobalEventProcessor adds processor to the global list of event
// processors. Global event processors apply to all events.
//
// Deprecated: Use Scope.AddEventProcessor or Client.AddEventProcessor instead.
func AddGlobalEventProcessor(processor EventProcessor) {
	globalEventProcessors = append(globalEventProcessors, processor)
}

// Integration allows for registering a functions that modify or discard captured events.
type Integration interface {
	Name() string
	SetupOnce(client *Client)
}

// ClientOptions that configures a SDK Client.
type ClientOptions struct {
	// The DSN to use. If the DSN is not set, the client is effectively
	// disabled.
	Dsn string
	// In debug mode, the debug information is printed to stdout to help you
	// understand what sentry is doing.
	Debug bool
	// Configures whether SDK should generate and attach stacktraces to pure
	// capture message calls.
	AttachStacktrace bool
	// The sample rate for event submission (0.0 - 1.0, defaults to 1.0).
	SampleRate float64
	// List of regexp strings that will be used to match against event's message
	// and if applicable, caught errors type and value.
	// If the match is found, then a whole event will be dropped.
	IgnoreErrors []string
	// Before send callback.
	BeforeSend func(event *Event, hint *EventHint) *Event
	// Before breadcrumb add callback.
	BeforeBreadcrumb func(breadcrumb *Breadcrumb, hint *BreadcrumbHint) *Breadcrumb
	// Integrations to be installed on the current Client, receives default
	// integrations.
	Integrations func([]Integration) []Integration
	// io.Writer implementation that should be used with the Debug mode.
	DebugWriter io.Writer
	// The transport to use. Defaults to HTTPTransport.
	Transport Transport
	// The server name to be reported.
	ServerName string
	// The release to be sent with events.
	Release string
	// The dist to be sent with events.
	Dist string
	// The environment to be sent with events.
	Environment string
	// Maximum number of breadcrumbs.
	MaxBreadcrumbs int
	// An optional pointer to http.Client that will be used with a default
	// HTTPTransport. Using your own client will make HTTPTransport, HTTPProxy,
	// HTTPSProxy and CaCerts options ignored.
	HTTPClient *http.Client
	// An optional pointer to http.Transport that will be used with a default
	// HTTPTransport. Using your own transport will make HTTPProxy, HTTPSProxy
	// and CaCerts options ignored.
	HTTPTransport http.RoundTripper
	// An optional HTTP proxy to use.
	// This will default to the HTTP_PROXY environment variable.
	HTTPProxy string
	// An optional HTTPS proxy to use.
	// This will default to the HTTPS_PROXY environment variable.
	// HTTPS_PROXY takes precedence over HTTP_PROXY for https requests.
	HTTPSProxy string
	// An optional set of SSL certificates to use.
	CaCerts *x509.CertPool
}

// Client is the underlying processor that is used by the main API and Hub
// instances.
type Client struct {
	options         ClientOptions
	dsn             *Dsn
	eventProcessors []EventProcessor
	integrations    []Integration
	Transport       Transport
}

// NewClient creates and returns an instance of Client configured using ClientOptions.
func NewClient(options ClientOptions) (*Client, error) {
	if options.Debug {
		debugWriter := options.DebugWriter
		if debugWriter == nil {
			debugWriter = os.Stderr
		}
		Logger.SetOutput(debugWriter)
	}

	if options.Dsn == "" {
		options.Dsn = os.Getenv("SENTRY_DSN")
	}

	if options.Release == "" {
		options.Release = os.Getenv("SENTRY_RELEASE")
	}

	if options.Environment == "" {
		options.Environment = os.Getenv("SENTRY_ENVIRONMENT")
	}

	var dsn *Dsn
	if options.Dsn != "" {
		var err error
		dsn, err = NewDsn(options.Dsn)
		if err != nil {
			return nil, err
		}
	}

	client := Client{
		options: options,
		dsn:     dsn,
	}

	client.setupTransport()
	client.setupIntegrations()

	return &client, nil
}

func (client *Client) setupTransport() {
	transport := client.options.Transport

	if transport == nil {
		if client.options.Dsn == "" {
			transport = new(noopTransport)
		} else {
			transport = NewHTTPTransport()
		}
	}

	transport.Configure(client.options)
	client.Transport = transport
}

func (client *Client) setupIntegrations() {
	integrations := []Integration{
		new(contextifyFramesIntegration),
		new(environmentIntegration),
		new(modulesIntegration),
		new(ignoreErrorsIntegration),
	}

	if client.options.Integrations != nil {
		integrations = client.options.Integrations(integrations)
	}

	for _, integration := range integrations {
		if client.integrationAlreadyInstalled(integration.Name()) {
			Logger.Printf("Integration %s is already installed\n", integration.Name())
			continue
		}
		client.integrations = append(client.integrations, integration)
		integration.SetupOnce(client)
		Logger.Printf("Integration installed: %s\n", integration.Name())
	}
}

// AddEventProcessor adds an event processor to the client.
func (client *Client) AddEventProcessor(processor EventProcessor) {
	client.eventProcessors = append(client.eventProcessors, processor)
}

// Options return ClientOptions for the current Client.
func (client Client) Options() ClientOptions {
	return client.options
}

// CaptureMessage captures an arbitrary message.
func (client *Client) CaptureMessage(message string, hint *EventHint, scope EventModifier) *EventID {
	event := client.eventFromMessage(message, LevelInfo)
	return client.CaptureEvent(event, hint, scope)
}

// CaptureException captures an error.
func (client *Client) CaptureException(exception error, hint *EventHint, scope EventModifier) *EventID {
	event := client.eventFromException(exception, LevelError)
	return client.CaptureEvent(event, hint, scope)
}

// CaptureEvent captures an event on the currently active client if any.
//
// The event must already be assembled. Typically code would instead use
// the utility methods like CaptureException. The return value is the
// event ID. In case Sentry is disabled or event was dropped, the return value will be nil.
func (client *Client) CaptureEvent(event *Event, hint *EventHint, scope EventModifier) *EventID {
	return client.processEvent(event, hint, scope)
}

// Recover captures a panic.
// Returns EventID if successfully, or nil if there's no error to recover from.
func (client *Client) Recover(err interface{}, hint *EventHint, scope EventModifier) *EventID {
	if err == nil {
		err = recover()
	}

	// Normally we would not pass a nil Context, but RecoverWithContext doesn't
	// use the Context for communicating deadline nor cancelation. All it does
	// is store the Context in the EventHint and there nil means the Context is
	// not available.
	//nolint: staticcheck
	return client.RecoverWithContext(nil, err, hint, scope)
}

// RecoverWithContext captures a panic and passes relevant context object.
// Returns EventID if successfully, or nil if there's no error to recover from.
func (client *Client) RecoverWithContext(
	ctx context.Context,
	err interface{},
	hint *EventHint,
	scope EventModifier,
) *EventID {
	if err == nil {
		err = recover()
	}
	if err == nil {
		return nil
	}

	if ctx != nil {
		if hint == nil {
			hint = &EventHint{}
		}
		if hint.Context == nil {
			hint.Context = ctx
		}
	}

	var event *Event
	switch err := err.(type) {
	case error:
		event = client.eventFromException(err, LevelFatal)
	case string:
		event = client.eventFromMessage(err, LevelFatal)
	default:
		event = client.eventFromMessage(fmt.Sprintf("%#v", err), LevelFatal)
	}
	return client.CaptureEvent(event, hint, scope)
}

// Flush waits until the underlying Transport sends any buffered events to the
// Sentry server, blocking for at most the given timeout. It returns false if
// the timeout was reached. In that case, some events may not have been sent.
//
// Flush should be called before terminating the program to avoid
// unintentionally dropping events.
//
// Do not call Flush indiscriminately after every call to CaptureEvent,
// CaptureException or CaptureMessage. Instead, to have the SDK send events over
// the network synchronously, configure it to use the HTTPSyncTransport in the
// call to Init.
func (client *Client) Flush(timeout time.Duration) bool {
	return client.Transport.Flush(timeout)
}

func (client *Client) eventFromMessage(message string, level Level) *Event {
	if message == "" {
		err := usageError{fmt.Errorf("%s called with empty message", callerFunctionName())}
		return client.eventFromException(err, level)
	}
	event := NewEvent()
	event.Level = level
	event.Message = message

	if client.Options().AttachStacktrace {
		event.Threads = []Thread{{
			Stacktrace: NewStacktrace(),
			Crashed:    false,
			Current:    true,
		}}
	}

	return event
}

func (client *Client) eventFromException(exception error, level Level) *Event {
	err := exception
	if err == nil {
		err = usageError{fmt.Errorf("%s called with nil error", callerFunctionName())}
	}

	event := NewEvent()
	event.Level = level

	for i := 0; i < maxErrorDepth && err != nil; i++ {
		event.Exception = append(event.Exception, Exception{
			Value:      err.Error(),
			Type:       reflect.TypeOf(err).String(),
			Stacktrace: ExtractStacktrace(err),
		})
		switch previous := err.(type) {
		case interface{ Unwrap() error }:
			err = previous.Unwrap()
		case interface{ Cause() error }:
			err = previous.Cause()
		default:
			err = nil
		}
	}

	// Add a trace of the current stack to the most recent error in a chain if
	// it doesn't have a stack trace yet.
	// We only add to the most recent error to avoid duplication and because the
	// current stack is most likely unrelated to errors deeper in the chain.
	if event.Exception[0].Stacktrace == nil {
		event.Exception[0].Stacktrace = NewStacktrace()
	}

	// event.Exception should be sorted such that the most recent error is last.
	reverse(event.Exception)

	return event
}

// reverse reverses the slice a in place.
func reverse(a []Exception) {
	for i := len(a)/2 - 1; i >= 0; i-- {
		opp := len(a) - 1 - i
		a[i], a[opp] = a[opp], a[i]
	}
}

func (client *Client) processEvent(event *Event, hint *EventHint, scope EventModifier) *EventID {
	if event == nil {
		err := usageError{fmt.Errorf("%s called with nil event", callerFunctionName())}
		return client.CaptureException(err, hint, scope)
	}

	options := client.Options()

	// TODO: Reconsider if its worth going away from default implementation
	// of other SDKs. In Go zero value (default) for float32 is 0.0,
	// which means that if someone uses ClientOptions{} struct directly
	// and we would not check for 0 here, we'd skip all events by default
	if options.SampleRate != 0.0 {
		randomFloat := rng.Float64()
		if randomFloat > options.SampleRate {
			Logger.Println("Event dropped due to SampleRate hit.")
			return nil
		}
	}

	if event = client.prepareEvent(event, hint, scope); event == nil {
		return nil
	}

	// As per spec, transactions do not go through BeforeSend.
	if event.Type != transactionType && options.BeforeSend != nil {
		h := &EventHint{}
		if hint != nil {
			h = hint
		}
		if event = options.BeforeSend(event, h); event == nil {
			Logger.Println("Event dropped due to BeforeSend callback.")
			return nil
		}
	}

	client.Transport.SendEvent(event)

	return &event.EventID
}

func (client *Client) prepareEvent(event *Event, hint *EventHint, scope EventModifier) *Event {
	if event.EventID == "" {
		event.EventID = EventID(uuid())
	}

	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	if event.Level == "" {
		event.Level = LevelInfo
	}

	if event.ServerName == "" {
		if client.Options().ServerName != "" {
			event.ServerName = client.Options().ServerName
		} else {
			event.ServerName = hostname
		}
	}

	if event.Release == "" && client.Options().Release != "" {
		event.Release = client.Options().Release
	}

	if event.Dist == "" && client.Options().Dist != "" {
		event.Dist = client.Options().Dist
	}

	if event.Environment == "" && client.Options().Environment != "" {
		event.Environment = client.Options().Environment
	}

	event.Platform = "go"
	event.Sdk = SdkInfo{
		Name:         "sentry.go",
		Version:      Version,
		Integrations: client.listIntegrations(),
		Packages: []SdkPackage{{
			Name:    "sentry-go",
			Version: Version,
		}},
	}

	if scope != nil {
		event = scope.ApplyToEvent(event, hint)
		if event == nil {
			return nil
		}
	}

	for _, processor := range client.eventProcessors {
		id := event.EventID
		event = processor(event, hint)
		if event == nil {
			Logger.Printf("Event dropped by one of the Client EventProcessors: %s\n", id)
			return nil
		}
	}

	for _, processor := range globalEventProcessors {
		id := event.EventID
		event = processor(event, hint)
		if event == nil {
			Logger.Printf("Event dropped by one of the Global EventProcessors: %s\n", id)
			return nil
		}
	}

	return event
}

func (client Client) listIntegrations() []string {
	integrations := make([]string, 0, len(client.integrations))
	for _, integration := range client.integrations {
		integrations = append(integrations, integration.Name())
	}
	sort.Strings(integrations)
	return integrations
}

func (client Client) integrationAlreadyInstalled(name string) bool {
	for _, integration := range client.integrations {
		if integration.Name() == name {
			return true
		}
	}
	return false
}
