package sse

import (
	"strconv"
	"strings"
	"sync"
)

const (
	sseDelimiter = ":"
	sseData      = "data"
	sseEvent     = "event"
	sseID        = "id"
	sseRetry     = "retry"
)

// RawEvent interface contains the methods that expose the incoming SSE properties
type RawEvent interface {
	ID() string
	Event() string
	Data() string
	Retry() int64
	IsError() bool
	IsEmpty() bool
}

// RawEventImpl represents an incoming SSE event
type RawEventImpl struct {
	id    string
	event string
	data  string
	retry int64
}

// ID returns the event id
func (r *RawEventImpl) ID() string { return r.id }

// Event returns the event type
func (r *RawEventImpl) Event() string { return r.event }

// Data returns the event associated data
func (r *RawEventImpl) Data() string { return r.data }

// Retry returns the expected retry time
func (r *RawEventImpl) Retry() int64 { return r.retry }

// IsError returns true if the message is an error
func (r *RawEventImpl) IsError() bool { return r.event == "error" }

// IsEmpty returns true if the event contains no id, event type and data
func (r *RawEventImpl) IsEmpty() bool { return r.event == "" && r.id == "" && r.data == "" }

// EventBuilder interface
type EventBuilder interface {
	AddLine(string)
	Build() *RawEventImpl
}

// EventBuilderImpl implenets the EventBuilder interface. Used to parse incoming event lines
type EventBuilderImpl struct {
	includesComment bool
	mutex           sync.Mutex
	lines           []string
}

// AddLine adds a new line belonging to the currently being processed event
func (b *EventBuilderImpl) AddLine(line string) {
	if strings.HasPrefix(line, sseDelimiter) {
		// Ignore comments
		return
	}

	b.mutex.Lock()
	defer b.mutex.Unlock()
	b.lines = append(b.lines, line)
}

// Build processes all the added lines and builds the event
func (b *EventBuilderImpl) Build() *RawEventImpl {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	if len(b.lines) == 0 { // Empty event
		return &RawEventImpl{}
	}

	e := &RawEventImpl{}
	for _, line := range b.lines {
		splitted := strings.SplitN(line, sseDelimiter, 2)
		if len(splitted) != 2 {
			// TODO: log invalid line.
			continue
		}

		switch splitted[0] {
		case sseID:
			e.id = strings.TrimSpace(splitted[1])
		case sseData:
			e.data = strings.TrimSpace(splitted[1])
		case sseEvent:
			e.event = strings.TrimSpace(splitted[1])
		case sseRetry:
			e.retry, _ = strconv.ParseInt(strings.TrimSpace(splitted[1]), 10, 64)
		}
	}

	return e
}

// Reset clears the lines accepted
func (b *EventBuilderImpl) Reset() {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	b.lines = []string{}
}

// NewEventBuilder constructs a new event builder
func NewEventBuilder() *EventBuilderImpl {
	return &EventBuilderImpl{lines: []string{}}
}
