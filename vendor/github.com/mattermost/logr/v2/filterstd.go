package logr

// StdFilter allows targets to filter via classic log levels where any level
// beyond a certain verbosity/severity is enabled.
type StdFilter struct {
	Lvl        Level
	Stacktrace Level
}

// GetEnabledLevel returns the Level with the specified Level.ID and whether the level
// is enabled for this filter.
func (lt StdFilter) GetEnabledLevel(level Level) (Level, bool) {
	enabled := level.ID <= lt.Lvl.ID
	stackTrace := level.ID <= lt.Stacktrace.ID
	var levelEnabled Level

	if enabled {
		switch level.ID {
		case Panic.ID:
			levelEnabled = Panic
		case Fatal.ID:
			levelEnabled = Fatal
		case Error.ID:
			levelEnabled = Error
		case Warn.ID:
			levelEnabled = Warn
		case Info.ID:
			levelEnabled = Info
		case Debug.ID:
			levelEnabled = Debug
		case Trace.ID:
			levelEnabled = Trace
		default:
			levelEnabled = level
		}
	}

	if stackTrace {
		levelEnabled.Stacktrace = true
	}

	return levelEnabled, enabled
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
	// Panic is the highest level of severity.
	Panic = Level{ID: 0, Name: "panic", Color: Red}
	// Fatal designates a catastrophic error.
	Fatal = Level{ID: 1, Name: "fatal", Color: Red}
	// Error designates a serious but possibly recoverable error.
	Error = Level{ID: 2, Name: "error", Color: Red}
	// Warn designates non-critical error.
	Warn = Level{ID: 3, Name: "warn", Color: Yellow}
	// Info designates information regarding application events.
	Info = Level{ID: 4, Name: "info", Color: Cyan}
	// Debug designates verbose information typically used for debugging.
	Debug = Level{ID: 5, Name: "debug", Color: NoColor}
	// Trace designates the highest verbosity of log output.
	Trace = Level{ID: 6, Name: "trace", Color: NoColor}
)
