// this is a new logger interface for mattermost

package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime"
	"time"
)

// Level - controls visibility of logged messages
type Level int

const (
	DEBUG Level = iota
	INFO
	ERROR
)

func (l Level) String() string {
	switch l {
	case DEBUG:
		return "DEBUG"
	case INFO:
		return "INFO"
	case ERROR:
		return "ERROR"
	}
	panic("Undefined log level specified")
}

// LogRecord - all information about a log message
type LogRecord struct {
	Level   Level             // The log level
	Created time.Time         // The time at which the log message was created (nanoseconds)
	Source  string            // The message source
	Message string            // The log message
	Context map[string]string // request context that should be included in the log message
}

func (r LogRecord) String() string {
	bytes, err := json.Marshal(&struct {
		Level   string            `json:"level"`
		Created string            `json:"timestamp"`
		Source  string            `json:"source"`
		Message string            `json:"message"`
		Context map[string]string `json:"context"`
	}{
		r.Level.String(),
		r.Created.Format(time.RFC3339), // iso-8601 timestamps are nice because they include time zone information
		r.Source,
		r.Message,
		r.Context,
	})
	if err != nil {
		// what to do?
	}
	return string(bytes)
}

// can't define a String() method on Context because it's an interface type...
func serializeContext(c context.Context) map[string]string {
	// TODO: we want to call c.Value(...) with a series of keys, and then call .String() on each of those keys and values,
	// putting the results in the map that we return. the problem is that we don't know which keys to use
	return make(map[string]string)
}

// Info logs an info level message
func Info(ctx context.Context, msg string) string {
	// determine caller func
	pc, _, lineno, ok := runtime.Caller(2)
	src := ""
	if ok {
		src = fmt.Sprintf("%s:%d", runtime.FuncForPC(pc).Name(), lineno)
	}

	// serializing the values of the context at logging time snapshots the context for later when we actually write
	// buffered log messages to somewhere useful
	rec := &LogRecord{
		Level:   INFO,
		Created: time.Now().UTC(),
		Source:  src,
		Message: msg,
		Context: serializeContext(ctx),
	}

	// TODO: actually do something useful with the JSON message rather than just returning it
	return (*rec).String()
}
