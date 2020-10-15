package analytics

import (
	"encoding/json"
	"time"
)

// Values implementing this interface are used by analytics clients to notify
// the application when a message send succeeded or failed.
//
// Callback methods are called by a client's internal goroutines, there are no
// guarantees on which goroutine will trigger the callbacks, the calls can be
// made sequentially or in parallel, the order doesn't depend on the order of
// messages were queued to the client.
//
// Callback methods must return quickly and not cause long blocking operations
// to avoid interferring with the client's internal work flow.
type Callback interface {

	// This method is called for every message that was successfully sent to
	// the API.
	Success(Message)

	// This method is called for every message that failed to be sent to the
	// API and will be discarded by the client.
	Failure(Message, error)
}

// This interface is used to represent analytics objects that can be sent via
// a client.
//
// Types like analytics.Track, analytics.Page, etc... implement this interface
// and therefore can be passed to the analytics.Client.Send method.
type Message interface {

	// Validate validates the internal structure of the message, the method must return
	// nil if the message is valid, or an error describing what went wrong.
	Validate() error

	// internal is an unexposed interface function to ensure only types defined within this package can satisfy the Message interface. Invoking this method will panic.
	internal()
}

// Takes a message id as first argument and returns it, unless it's the zero-
// value, in that case the default id passed as second argument is returned.
func makeMessageId(id string, def string) string {
	if len(id) == 0 {
		return def
	}
	return id
}

// Returns the time value passed as first argument, unless it's the zero-value,
// in that case the default value passed as second argument is returned.
func makeTimestamp(t time.Time, def time.Time) time.Time {
	if t == (time.Time{}) {
		return def
	}
	return t
}

// This structure represents objects sent to the /v1/batch endpoint. We don't
// export this type because it's only meant to be used internally to send groups
// of messages in one API call.
type batch struct {
	MessageId string    `json:"messageId"`
	SentAt    time.Time `json:"sentAt"`
	Messages  []message `json:"batch"`
	Context   *Context  `json:"context"`
}

type message struct {
	msg  Message
	json []byte
}

func makeMessage(m Message, maxBytes int) (msg message, err error) {
	if msg.json, err = json.Marshal(m); err == nil {
		if len(msg.json) > maxBytes {
			err = ErrMessageTooBig
		} else {
			msg.msg = m
		}
	}
	return
}

func (m message) MarshalJSON() ([]byte, error) {
	return m.json, nil
}

func (m message) size() int {
	// The `+ 1` is for the comma that sits between each items of a JSON array.
	return len(m.json) + 1
}

type messageQueue struct {
	pending       []message
	bytes         int
	maxBatchSize  int
	maxBatchBytes int
}

func (q *messageQueue) push(m message) (b []message) {
	if (q.bytes + m.size()) > q.maxBatchBytes {
		b = q.flush()
	}

	if q.pending == nil {
		q.pending = make([]message, 0, q.maxBatchSize)
	}

	q.pending = append(q.pending, m)
	q.bytes += len(m.json)

	if b == nil && len(q.pending) == q.maxBatchSize {
		b = q.flush()
	}

	return
}

func (q *messageQueue) flush() (msgs []message) {
	msgs, q.pending, q.bytes = q.pending, nil, 0
	return
}

const (
	maxBatchBytes   = 500000
	maxMessageBytes = 32000
)
