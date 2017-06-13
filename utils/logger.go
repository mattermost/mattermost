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
	Level   Level           // The log level
	Created time.Time       // The time at which the log message was created (nanoseconds)
	Source  string          // The message source
	Message string          // The log message
	Context context.Context // Any context associated with the message
}

func (r LogRecord) String() string {
	bytes, err := json.Marshal(&struct {
		Level   string `json:"level"`
		Created string `json:"timestamp"`
		Source  string `json:"source"`
		Message string `json:"message"`
		Context string `json:"context"`
	}{
		r.Level.String(),
		r.Created.Format(time.RFC3339),
		r.Source,
		r.Message,
		serializeContext(r.Context),
	})
	if err != nil {
		// what to do?
	}
	return string(bytes)
}

// TODO: figure out how to serialize the fields of Context
// can't define a String() method on it because it's an interface type
// See https://golang.org/pkg/context/
func serializeContext(c context.Context) string {
	return "{}"
}

// Info logs an info level message
func Info(ctx context.Context, msg string) string {
	// determine caller func
	pc, _, lineno, ok := runtime.Caller(2)
	src := ""
	if ok {
		src = fmt.Sprintf("%s:%d", runtime.FuncForPC(pc).Name(), lineno)
	}

	rec := &LogRecord{
		Level:   INFO,
		Created: time.Now().UTC(),
		Source:  src,
		Message: msg,
		Context: ctx,
	}

	// TODO: actually do something useful with the JSON message rather than just returning it
	return (*rec).String()
}
