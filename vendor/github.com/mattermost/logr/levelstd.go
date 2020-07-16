package logr

// StdFilter allows targets to filter via classic log levels where any level
// beyond a certain verbosity/severity is enabled.
type StdFilter struct {
	Lvl        Level
	Stacktrace Level
}

// IsEnabled returns true if the specified Level is at or above this verbosity. Also
// determines if a stack trace is required.
func (lt StdFilter) IsEnabled(level Level) bool {
	return level.ID <= lt.Lvl.ID
}

// IsStacktraceEnabled returns true if the specified Level requires a stack trace.
func (lt StdFilter) IsStacktraceEnabled(level Level) bool {
	return level.ID <= lt.Stacktrace.ID
}

var (
	// Panic is the highest level of severity. Logs the message and then panics.
	Panic = Level{ID: 0, Name: "panic"}
	// Fatal designates a catastrophic error. Logs the message and then calls
	// `logr.Exit(1)`.
	Fatal = Level{ID: 1, Name: "fatal"}
	// Error designates a serious but possibly recoverable error.
	Error = Level{ID: 2, Name: "error"}
	// Warn designates non-critical error.
	Warn = Level{ID: 3, Name: "warn"}
	// Info designates information regarding application events.
	Info = Level{ID: 4, Name: "info"}
	// Debug designates verbose information typically used for debugging.
	Debug = Level{ID: 5, Name: "debug"}
	// Trace designates the highest verbosity of log output.
	Trace = Level{ID: 6, Name: "trace"}
)
