package sentry

import (
	"bytes"
	"io"
	"net/http"
	"reflect"
	"sync"
	"time"
)

// Scope holds contextual data for the current scope.
//
// The scope is an object that can cloned efficiently and stores data that is
// locally relevant to an event. For instance the scope will hold recorded
// breadcrumbs and similar information.
//
// The scope can be interacted with in two ways. First, the scope is routinely
// updated with information by functions such as AddBreadcrumb which will modify
// the current scope. Second, the current scope can be configured through the
// ConfigureScope function or Hub method of the same name.
//
// The scope is meant to be modified but not inspected directly. When preparing
// an event for reporting, the current client adds information from the current
// scope into the event.
type Scope struct {
	mu          sync.RWMutex
	breadcrumbs []*Breadcrumb
	user        User
	tags        map[string]string
	contexts    map[string]interface{}
	extra       map[string]interface{}
	fingerprint []string
	level       Level
	transaction string
	request     *http.Request
	// requestBody holds a reference to the original request.Body.
	requestBody interface {
		// Bytes returns bytes from the original body, lazily buffered as the
		// original body is read.
		Bytes() []byte
		// Overflow returns true if the body is larger than the maximum buffer
		// size.
		Overflow() bool
	}
	eventProcessors []EventProcessor
}

// NewScope creates a new Scope.
func NewScope() *Scope {
	scope := Scope{
		breadcrumbs: make([]*Breadcrumb, 0),
		tags:        make(map[string]string),
		contexts:    make(map[string]interface{}),
		extra:       make(map[string]interface{}),
		fingerprint: make([]string, 0),
	}

	return &scope
}

// AddBreadcrumb adds new breadcrumb to the current scope
// and optionally throws the old one if limit is reached.
func (scope *Scope) AddBreadcrumb(breadcrumb *Breadcrumb, limit int) {
	if breadcrumb.Timestamp.IsZero() {
		breadcrumb.Timestamp = time.Now().UTC()
	}

	scope.mu.Lock()
	defer scope.mu.Unlock()

	breadcrumbs := append(scope.breadcrumbs, breadcrumb)
	if len(breadcrumbs) > limit {
		scope.breadcrumbs = breadcrumbs[1 : limit+1]
	} else {
		scope.breadcrumbs = breadcrumbs
	}
}

// ClearBreadcrumbs clears all breadcrumbs from the current scope.
func (scope *Scope) ClearBreadcrumbs() {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.breadcrumbs = []*Breadcrumb{}
}

// SetUser sets the user for the current scope.
func (scope *Scope) SetUser(user User) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.user = user
}

// SetRequest sets the request for the current scope.
func (scope *Scope) SetRequest(r *http.Request) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.request = r

	if r == nil {
		return
	}

	// Don't buffer request body if we know it is oversized.
	if r.ContentLength > maxRequestBodyBytes {
		return
	}
	// Don't buffer if there is no body.
	if r.Body == nil || r.Body == http.NoBody {
		return
	}
	buf := &limitedBuffer{Capacity: maxRequestBodyBytes}
	r.Body = readCloser{
		Reader: io.TeeReader(r.Body, buf),
		Closer: r.Body,
	}
	scope.requestBody = buf
}

// SetRequestBody sets the request body for the current scope.
//
// This method should only be called when the body bytes are already available
// in memory. Typically, the request body is buffered lazily from the
// Request.Body from SetRequest.
func (scope *Scope) SetRequestBody(b []byte) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	capacity := maxRequestBodyBytes
	overflow := false
	if len(b) > capacity {
		overflow = true
		b = b[:capacity]
	}
	scope.requestBody = &limitedBuffer{
		Capacity: capacity,
		Buffer:   *bytes.NewBuffer(b),
		overflow: overflow,
	}
}

// maxRequestBodyBytes is the default maximum request body size to send to
// Sentry.
const maxRequestBodyBytes = 10 * 1024

// A limitedBuffer is like a bytes.Buffer, but limited to store at most Capacity
// bytes. Any writes past the capacity are silently discarded, similar to
// ioutil.Discard.
type limitedBuffer struct {
	Capacity int

	bytes.Buffer
	overflow bool
}

// Write implements io.Writer.
func (b *limitedBuffer) Write(p []byte) (n int, err error) {
	// Silently ignore writes after overflow.
	if b.overflow {
		return len(p), nil
	}
	left := b.Capacity - b.Len()
	if left < 0 {
		left = 0
	}
	if len(p) > left {
		b.overflow = true
		p = p[:left]
	}
	return b.Buffer.Write(p)
}

// Overflow returns true if the limitedBuffer discarded bytes written to it.
func (b *limitedBuffer) Overflow() bool {
	return b.overflow
}

// readCloser combines an io.Reader and an io.Closer to implement io.ReadCloser.
type readCloser struct {
	io.Reader
	io.Closer
}

// SetTag adds a tag to the current scope.
func (scope *Scope) SetTag(key, value string) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.tags[key] = value
}

// SetTags assigns multiple tags to the current scope.
func (scope *Scope) SetTags(tags map[string]string) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	for k, v := range tags {
		scope.tags[k] = v
	}
}

// RemoveTag removes a tag from the current scope.
func (scope *Scope) RemoveTag(key string) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	delete(scope.tags, key)
}

// SetContext adds a context to the current scope.
func (scope *Scope) SetContext(key string, value interface{}) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.contexts[key] = value
}

// SetContexts assigns multiple contexts to the current scope.
func (scope *Scope) SetContexts(contexts map[string]interface{}) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	for k, v := range contexts {
		scope.contexts[k] = v
	}
}

// RemoveContext removes a context from the current scope.
func (scope *Scope) RemoveContext(key string) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	delete(scope.contexts, key)
}

// SetExtra adds an extra to the current scope.
func (scope *Scope) SetExtra(key string, value interface{}) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.extra[key] = value
}

// SetExtras assigns multiple extras to the current scope.
func (scope *Scope) SetExtras(extra map[string]interface{}) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	for k, v := range extra {
		scope.extra[k] = v
	}
}

// RemoveExtra removes a extra from the current scope.
func (scope *Scope) RemoveExtra(key string) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	delete(scope.extra, key)
}

// SetFingerprint sets new fingerprint for the current scope.
func (scope *Scope) SetFingerprint(fingerprint []string) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.fingerprint = fingerprint
}

// SetLevel sets new level for the current scope.
func (scope *Scope) SetLevel(level Level) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.level = level
}

// SetTransaction sets new transaction name for the current transaction.
func (scope *Scope) SetTransaction(transactionName string) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.transaction = transactionName
}

// Clone returns a copy of the current scope with all data copied over.
func (scope *Scope) Clone() *Scope {
	scope.mu.RLock()
	defer scope.mu.RUnlock()

	clone := NewScope()
	clone.user = scope.user
	clone.breadcrumbs = make([]*Breadcrumb, len(scope.breadcrumbs))
	copy(clone.breadcrumbs, scope.breadcrumbs)
	for key, value := range scope.tags {
		clone.tags[key] = value
	}
	for key, value := range scope.contexts {
		clone.contexts[key] = value
	}
	for key, value := range scope.extra {
		clone.extra[key] = value
	}
	clone.fingerprint = make([]string, len(scope.fingerprint))
	copy(clone.fingerprint, scope.fingerprint)
	clone.level = scope.level
	clone.transaction = scope.transaction
	clone.request = scope.request
	clone.requestBody = scope.requestBody

	return clone
}

// Clear removes the data from the current scope. Not safe for concurrent use.
func (scope *Scope) Clear() {
	*scope = *NewScope()
}

// AddEventProcessor adds an event processor to the current scope.
func (scope *Scope) AddEventProcessor(processor EventProcessor) {
	scope.mu.Lock()
	defer scope.mu.Unlock()

	scope.eventProcessors = append(scope.eventProcessors, processor)
}

// ApplyToEvent takes the data from the current scope and attaches it to the event.
func (scope *Scope) ApplyToEvent(event *Event, hint *EventHint) *Event {
	scope.mu.RLock()
	defer scope.mu.RUnlock()

	if len(scope.breadcrumbs) > 0 {
		if event.Breadcrumbs == nil {
			event.Breadcrumbs = []*Breadcrumb{}
		}

		event.Breadcrumbs = append(event.Breadcrumbs, scope.breadcrumbs...)
	}

	if len(scope.tags) > 0 {
		if event.Tags == nil {
			event.Tags = make(map[string]string)
		}

		for key, value := range scope.tags {
			event.Tags[key] = value
		}
	}

	if len(scope.contexts) > 0 {
		if event.Contexts == nil {
			event.Contexts = make(map[string]interface{})
		}

		for key, value := range scope.contexts {
			event.Contexts[key] = value
		}
	}

	if len(scope.extra) > 0 {
		if event.Extra == nil {
			event.Extra = make(map[string]interface{})
		}

		for key, value := range scope.extra {
			event.Extra[key] = value
		}
	}

	if (reflect.DeepEqual(event.User, User{})) {
		event.User = scope.user
	}

	if (event.Fingerprint == nil || len(event.Fingerprint) == 0) &&
		len(scope.fingerprint) > 0 {
		event.Fingerprint = make([]string, len(scope.fingerprint))
		copy(event.Fingerprint, scope.fingerprint)
	}

	if scope.level != "" {
		event.Level = scope.level
	}

	if scope.transaction != "" {
		event.Transaction = scope.transaction
	}

	if event.Request == nil && scope.request != nil {
		event.Request = NewRequest(scope.request)
		// NOTE: The SDK does not attempt to send partial request body data.
		//
		// The reason being that Sentry's ingest pipeline and UI are optimized
		// to show structured data. Additionally, tooling around PII scrubbing
		// relies on structured data; truncated request bodies would create
		// invalid payloads that are more prone to leaking PII data.
		//
		// Users can still send more data along their events if they want to,
		// for example using Event.Extra.
		if scope.requestBody != nil && !scope.requestBody.Overflow() {
			event.Request.Data = string(scope.requestBody.Bytes())
		}
	}

	for _, processor := range scope.eventProcessors {
		id := event.EventID
		event = processor(event, hint)
		if event == nil {
			Logger.Printf("Event dropped by one of the Scope EventProcessors: %s\n", id)
			return nil
		}
	}

	return event
}
