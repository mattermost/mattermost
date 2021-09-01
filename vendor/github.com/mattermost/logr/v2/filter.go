package logr

// Filter allows targets to determine which Level(s) are active
// for logging and which Level(s) require a stack trace to be output.
// A default implementation using "panic, fatal..." is provided, and
// a more flexible alternative implementation is also provided that
// allows any number of custom levels.
type Filter interface {
	GetEnabledLevel(level Level) (Level, bool)
}
