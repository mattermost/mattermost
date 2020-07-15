package logr

// LevelID is the unique id of each level.
type LevelID uint

// Level provides a mechanism to enable/disable specific log lines.
type Level struct {
	ID         LevelID
	Name       string
	Stacktrace bool
}

// String returns the name of this level.
func (level Level) String() string {
	return level.Name
}

// Filter allows targets to determine which Level(s) are active
// for logging and which Level(s) require a stack trace to be output.
// A default implementation using "panic, fatal..." is provided, and
// a more flexible alternative implementation is also provided that
// allows any number of custom levels.
type Filter interface {
	IsEnabled(Level) bool
	IsStacktraceEnabled(Level) bool
}
