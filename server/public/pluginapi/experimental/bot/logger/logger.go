package logger

import "time"

const (
	timed   = "__since"
	elapsed = "Elapsed"

	ErrorKey = "error"
)

// LogLevel defines the level of log messages
type LogLevel string

const (
	// LogLevelDebug denotes debug messages
	LogLevelDebug = "debug"
	// LogLevelInfo denotes info messages
	LogLevelInfo = "info"
	// LogLevelWarn denotes warn messages
	LogLevelWarn = "warn"
	// LogLevelError denotes error messages
	LogLevelError = "error"
)

// LogContext defines the context for the logs.
type LogContext map[string]interface{}

// Logger defines an object able to log messages.
type Logger interface {
	// With adds a logContext to the logger.
	With(LogContext) Logger
	// WithError adds an Error to the logger.
	WithError(error) Logger
	// Context returns the current context
	Context() LogContext
	// Timed add a timed log context.
	Timed() Logger
	// Debugf logs a formatted string as a debug message.
	Debugf(format string, args ...interface{})
	// Errorf logs a formatted string as an error message.
	Errorf(format string, args ...interface{})
	// Infof logs a formatted string as an info message.
	Infof(format string, args ...interface{})
	// Warnf logs a formatted string as an warning message.
	Warnf(format string, args ...interface{})
}

func measure(lc LogContext) {
	if lc[timed] == nil {
		return
	}
	started := lc[timed].(time.Time)
	lc[elapsed] = time.Since(started).String()
	delete(lc, timed)
}

// Level assigns an integer to the LogLevel string
func Level(l LogLevel) int {
	switch l {
	case LogLevelDebug:
		return 4
	case LogLevelInfo:
		return 3
	case LogLevelWarn:
		return 2
	case LogLevelError:
		return 1
	}
	return 0
}

func toKeyValuePairs(in map[string]interface{}) (out []interface{}) {
	for k, v := range in {
		out = append(out, k, v)
	}
	return out
}
