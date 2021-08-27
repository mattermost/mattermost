package logr

import "log"

// Logger provides context for logging via fields.
type Logger struct {
	lgr    *Logr
	fields []Field
}

// Logr returns the `Logr` instance that created this `Logger`.
func (logger Logger) Logr() *Logr {
	return logger.lgr
}

// With creates a new `Logger` with any existing fields plus the new ones.
func (logger Logger) With(fields ...Field) Logger {
	l := Logger{lgr: logger.lgr}
	size := len(logger.fields) + len(fields)
	if size > 0 {
		l.fields = make([]Field, 0, size)
		l.fields = append(l.fields, logger.fields...)
		l.fields = append(l.fields, fields...)
	}
	return l
}

// StdLogger creates a standard logger backed by this `Logr.Logger` instance.
// All log records are emitted with the specified log level.
func (logger Logger) StdLogger(level Level) *log.Logger {
	return NewStdLogger(level, logger)
}

// IsLevelEnabled determines if the specified level is enabled for at least
// one log target.
func (logger Logger) IsLevelEnabled(level Level) bool {
	status := logger.Logr().IsLevelEnabled(level)
	return status.Enabled
}

// Sugar creates a new `Logger` with a less structured API. Any fields are preserved.
func (logger Logger) Sugar(fields ...Field) Sugar {
	return Sugar{
		logger: logger.With(fields...),
	}
}

// Log checks that the level matches one or more targets, and
// if so, generates a log record that is added to the Logr queue.
// Arguments are handled in the manner of fmt.Print.
func (logger Logger) Log(lvl Level, msg string, fields ...Field) {
	status := logger.lgr.IsLevelEnabled(lvl)
	if status.Enabled {
		rec := NewLogRec(lvl, logger, msg, fields, status.Stacktrace)
		logger.lgr.enqueue(rec)
	}
}

// LogM calls `Log` multiple times, one for each level provided.
func (logger Logger) LogM(levels []Level, msg string, fields ...Field) {
	for _, lvl := range levels {
		logger.Log(lvl, msg, fields...)
	}
}

// Trace is a convenience method equivalent to `Log(TraceLevel, msg, fields...)`.
func (logger Logger) Trace(msg string, fields ...Field) {
	logger.Log(Trace, msg, fields...)
}

// Debug is a convenience method equivalent to `Log(DebugLevel, msg, fields...)`.
func (logger Logger) Debug(msg string, fields ...Field) {
	logger.Log(Debug, msg, fields...)
}

// Info is a convenience method equivalent to `Log(InfoLevel, msg, fields...)`.
func (logger Logger) Info(msg string, fields ...Field) {
	logger.Log(Info, msg, fields...)
}

// Warn is a convenience method equivalent to `Log(WarnLevel, msg, fields...)`.
func (logger Logger) Warn(msg string, fields ...Field) {
	logger.Log(Warn, msg, fields...)
}

// Error is a convenience method equivalent to `Log(ErrorLevel, msg, fields...)`.
func (logger Logger) Error(msg string, fields ...Field) {
	logger.Log(Error, msg, fields...)
}

// Fatal is a convenience method equivalent to `Log(FatalLevel, msg, fields...)`
func (logger Logger) Fatal(msg string, fields ...Field) {
	logger.Log(Fatal, msg, fields...)
}

// Panic is a convenience method equivalent to `Log(PanicLevel, msg, fields...)`
func (logger Logger) Panic(msg string, fields ...Field) {
	logger.Log(Panic, msg, fields...)
}
