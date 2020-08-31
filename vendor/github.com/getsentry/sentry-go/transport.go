package sentry

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
)

const defaultBufferSize = 30
const defaultRetryAfter = time.Second * 60
const defaultTimeout = time.Second * 30

// Transport is used by the `Client` to deliver events to remote server.
type Transport interface {
	Flush(timeout time.Duration) bool
	Configure(options ClientOptions)
	SendEvent(event *Event)
}

func getProxyConfig(options ClientOptions) func(*http.Request) (*url.URL, error) {
	if options.HTTPSProxy != "" {
		return func(_ *http.Request) (*url.URL, error) {
			return url.Parse(options.HTTPSProxy)
		}
	} else if options.HTTPProxy != "" {
		return func(_ *http.Request) (*url.URL, error) {
			return url.Parse(options.HTTPProxy)
		}
	}

	return http.ProxyFromEnvironment
}

func getTLSConfig(options ClientOptions) *tls.Config {
	if options.CaCerts != nil {
		return &tls.Config{
			RootCAs: options.CaCerts,
		}
	}

	return nil
}

func retryAfter(now time.Time, r *http.Response) time.Duration {
	retryAfterHeader := r.Header["Retry-After"]

	if retryAfterHeader == nil {
		return defaultRetryAfter
	}

	if date, err := time.Parse(time.RFC1123, retryAfterHeader[0]); err == nil {
		return date.Sub(now)
	}

	if seconds, err := strconv.Atoi(retryAfterHeader[0]); err == nil {
		return time.Second * time.Duration(seconds)
	}

	return defaultRetryAfter
}

func getRequestBodyFromEvent(event *Event) []byte {
	body, err := json.Marshal(event)
	if err == nil {
		return body
	}

	partialMarshallMessage := "Original event couldn't be marshalled. Succeeded by stripping the data " +
		"that uses interface{} type. Please verify that the data you attach to the scope is serializable."
	// Try to serialize the event, with all the contextual data that allows for interface{} stripped.
	event.Breadcrumbs = nil
	event.Contexts = nil
	event.Extra = map[string]interface{}{
		"info": partialMarshallMessage,
	}
	body, err = json.Marshal(event)
	if err == nil {
		Logger.Println(partialMarshallMessage)
		return body
	}

	// This should _only_ happen when Event.Exception[0].Stacktrace.Frames[0].Vars is unserializable
	// Which won't ever happen, as we don't use it now (although it's the part of public interface accepted by Sentry)
	// Juuust in case something, somehow goes utterly wrong.
	Logger.Println("Event couldn't be marshalled, even with stripped contextual data. Skipping delivery. " +
		"Please notify the SDK owners with possibly broken payload.")
	return nil
}

// ================================
// HTTPTransport
// ================================

// A batch groups items that are processed sequentially.
type batch struct {
	items   chan *http.Request
	started chan struct{} // closed to signal items started to be worked on
	done    chan struct{} // closed to signal completion of all items
}

// HTTPTransport is a default implementation of `Transport` interface used by `Client`.
type HTTPTransport struct {
	dsn       *Dsn
	client    *http.Client
	transport http.RoundTripper

	// buffer is a channel of batches. Calling Flush terminates work on the
	// current in-flight items and starts a new batch for subsequent events.
	buffer chan batch

	start sync.Once

	// Size of the transport buffer. Defaults to 30.
	BufferSize int
	// HTTP Client request timeout. Defaults to 30 seconds.
	Timeout time.Duration

	mu            sync.RWMutex
	disabledUntil time.Time
}

// NewHTTPTransport returns a new pre-configured instance of HTTPTransport
func NewHTTPTransport() *HTTPTransport {
	transport := HTTPTransport{
		BufferSize: defaultBufferSize,
		Timeout:    defaultTimeout,
	}
	return &transport
}

// Configure is called by the `Client` itself, providing it it's own `ClientOptions`.
func (t *HTTPTransport) Configure(options ClientOptions) {
	dsn, err := NewDsn(options.Dsn)
	if err != nil {
		Logger.Printf("%v\n", err)
		return
	}
	t.dsn = dsn

	// A buffered channel with capacity 1 works like a mutex, ensuring only one
	// goroutine can access the current batch at a given time. Access is
	// synchronized by reading from and writing to the channel.
	t.buffer = make(chan batch, 1)
	t.buffer <- batch{
		items:   make(chan *http.Request, t.BufferSize),
		started: make(chan struct{}),
		done:    make(chan struct{}),
	}

	if options.HTTPTransport != nil {
		t.transport = options.HTTPTransport
	} else {
		t.transport = &http.Transport{
			Proxy:           getProxyConfig(options),
			TLSClientConfig: getTLSConfig(options),
		}
	}

	if options.HTTPClient != nil {
		t.client = options.HTTPClient
	} else {
		t.client = &http.Client{
			Transport: t.transport,
			Timeout:   t.Timeout,
		}
	}

	t.start.Do(func() {
		go t.worker()
	})
}

// SendEvent assembles a new packet out of `Event` and sends it to remote server.
func (t *HTTPTransport) SendEvent(event *Event) {
	if t.dsn == nil {
		return
	}
	t.mu.RLock()
	disabled := time.Now().Before(t.disabledUntil)
	t.mu.RUnlock()
	if disabled {
		return
	}

	body := getRequestBodyFromEvent(event)
	if body == nil {
		return
	}

	request, _ := http.NewRequest(
		http.MethodPost,
		t.dsn.StoreAPIURL().String(),
		bytes.NewBuffer(body),
	)

	for headerKey, headerValue := range t.dsn.RequestHeaders() {
		request.Header.Set(headerKey, headerValue)
	}

	// <-t.buffer is equivalent to acquiring a lock to access the current batch.
	// A few lines below, t.buffer <- b releases the lock.
	//
	// The lock must be held during the select block below to guarantee that
	// b.items is not closed while trying to send to it. Remember that sending
	// on a closed channel panics.
	//
	// Note that the select block takes a bounded amount of CPU time because of
	// the default case that is executed if sending on b.items would block. That
	// is, the event is dropped if it cannot be sent immediately to the b.items
	// channel (used as a queue).
	b := <-t.buffer

	select {
	case b.items <- request:
		Logger.Printf(
			"Sending %s event [%s] to %s project: %d\n",
			event.Level,
			event.EventID,
			t.dsn.host,
			t.dsn.projectID,
		)
	default:
		Logger.Println("Event dropped due to transport buffer being full.")
	}

	t.buffer <- b
}

// Flush waits until any buffered events are sent to the Sentry server, blocking
// for at most the given timeout. It returns false if the timeout was reached.
// In that case, some events may not have been sent.
//
// Flush should be called before terminating the program to avoid
// unintentionally dropping events.
//
// Do not call Flush indiscriminately after every call to SendEvent. Instead, to
// have the SDK send events over the network synchronously, configure it to use
// the HTTPSyncTransport in the call to Init.
func (t *HTTPTransport) Flush(timeout time.Duration) bool {
	toolate := time.After(timeout)

	// Wait until processing the current batch has started or the timeout.
	//
	// We must wait until the worker has seen the current batch, because it is
	// the only way b.done will be closed. If we do not wait, there is a
	// possible execution flow in which b.done is never closed, and the only way
	// out of Flush would be waiting for the timeout, which is undesired.
	var b batch
	for {
		select {
		case b = <-t.buffer:
			select {
			case <-b.started:
				goto started
			default:
				t.buffer <- b
			}
		case <-toolate:
			goto fail
		}
	}

started:
	// Signal that there won't be any more items in this batch, so that the
	// worker inner loop can end.
	close(b.items)
	// Start a new batch for subsequent events.
	t.buffer <- batch{
		items:   make(chan *http.Request, t.BufferSize),
		started: make(chan struct{}),
		done:    make(chan struct{}),
	}

	// Wait until the current batch is done or the timeout.
	select {
	case <-b.done:
		Logger.Println("Buffer flushed successfully.")
		return true
	case <-toolate:
		goto fail
	}

fail:
	Logger.Println("Buffer flushing reached the timeout.")
	return false
}

func (t *HTTPTransport) worker() {
	for b := range t.buffer {
		// Signal that processing of the current batch has started.
		close(b.started)

		// Return the batch to the buffer so that other goroutines can use it.
		// Equivalent to releasing a lock.
		t.buffer <- b

		// Process all batch items.
		for request := range b.items {
			t.mu.RLock()
			disabled := time.Now().Before(t.disabledUntil)
			t.mu.RUnlock()
			if disabled {
				continue
			}

			response, err := t.client.Do(request)

			if err != nil {
				Logger.Printf("There was an issue with sending an event: %v", err)
			}

			if response != nil && response.StatusCode == http.StatusTooManyRequests {
				deadline := time.Now().Add(retryAfter(time.Now(), response))
				t.mu.Lock()
				t.disabledUntil = deadline
				t.mu.Unlock()
				Logger.Printf("Too many requests, backing off till: %s\n", deadline)
			}
		}

		// Signal that processing of the batch is done.
		close(b.done)
	}
}

// ================================
// HTTPSyncTransport
// ================================

// HTTPSyncTransport is an implementation of `Transport` interface which blocks after each captured event.
type HTTPSyncTransport struct {
	dsn           *Dsn
	client        *http.Client
	transport     http.RoundTripper
	disabledUntil time.Time

	// HTTP Client request timeout. Defaults to 30 seconds.
	Timeout time.Duration
}

// NewHTTPSyncTransport returns a new pre-configured instance of HTTPSyncTransport
func NewHTTPSyncTransport() *HTTPSyncTransport {
	transport := HTTPSyncTransport{
		Timeout: defaultTimeout,
	}

	return &transport
}

// Configure is called by the `Client` itself, providing it it's own `ClientOptions`.
func (t *HTTPSyncTransport) Configure(options ClientOptions) {
	dsn, err := NewDsn(options.Dsn)
	if err != nil {
		Logger.Printf("%v\n", err)
		return
	}
	t.dsn = dsn

	if options.HTTPTransport != nil {
		t.transport = options.HTTPTransport
	} else {
		t.transport = &http.Transport{
			Proxy:           getProxyConfig(options),
			TLSClientConfig: getTLSConfig(options),
		}
	}

	if options.HTTPClient != nil {
		t.client = options.HTTPClient
	} else {
		t.client = &http.Client{
			Transport: t.transport,
			Timeout:   t.Timeout,
		}
	}
}

// SendEvent assembles a new packet out of `Event` and sends it to remote server.
func (t *HTTPSyncTransport) SendEvent(event *Event) {
	if t.dsn == nil || time.Now().Before(t.disabledUntil) {
		return
	}

	body := getRequestBodyFromEvent(event)
	if body == nil {
		return
	}

	request, _ := http.NewRequest(
		http.MethodPost,
		t.dsn.StoreAPIURL().String(),
		bytes.NewBuffer(body),
	)

	for headerKey, headerValue := range t.dsn.RequestHeaders() {
		request.Header.Set(headerKey, headerValue)
	}

	Logger.Printf(
		"Sending %s event [%s] to %s project: %d\n",
		event.Level,
		event.EventID,
		t.dsn.host,
		t.dsn.projectID,
	)

	response, err := t.client.Do(request)

	if err != nil {
		Logger.Printf("There was an issue with sending an event: %v", err)
	}

	if response != nil && response.StatusCode == http.StatusTooManyRequests {
		t.disabledUntil = time.Now().Add(retryAfter(time.Now(), response))
		Logger.Printf("Too many requests, backing off till: %s\n", t.disabledUntil)
	}
}

// Flush is a no-op for HTTPSyncTransport. It always returns true immediately.
func (t *HTTPSyncTransport) Flush(_ time.Duration) bool {
	return true
}

// ================================
// noopTransport
// ================================

// noopTransport is an implementation of `Transport` interface which drops all the events.
// Only used internally when an empty DSN is provided, which effectively disables the SDK.
type noopTransport struct{}

func (t *noopTransport) Configure(options ClientOptions) {
	Logger.Println("Sentry client initialized with an empty DSN. Using noopTransport. No events will be delivered.")
}

func (t *noopTransport) SendEvent(event *Event) {
	Logger.Println("Event dropped due to noopTransport usage.")
}

func (t *noopTransport) Flush(_ time.Duration) bool {
	return true
}
