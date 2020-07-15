package logr

import (
	"fmt"
)

// Fields type, used to pass to `WithFields`.
type Fields map[string]interface{}

// Logger provides context for logging via fields.
type Logger struct {
	logr   *Logr
	fields Fields
}

// Logr returns the `Logr` instance that created this `Logger`.
func (logger Logger) Logr() *Logr {
	return logger.logr
}

// WithField creates a new `Logger` with any existing fields
// plus the new one.
func (logger Logger) WithField(key string, value interface{}) Logger {
	return logger.WithFields(Fields{key: value})
}

// WithFields creates a new `Logger` with any existing fields
// plus the new ones.
func (logger Logger) WithFields(fields Fields) Logger {
	l := Logger{logr: logger.logr}
	// if parent has no fields then avoid creating a new map.
	oldLen := len(logger.fields)
	if oldLen == 0 {
		l.fields = fields
		return l
	}

	l.fields = make(Fields, len(fields)+oldLen)
	for k, v := range logger.fields {
		l.fields[k] = v
	}
	for k, v := range fields {
		l.fields[k] = v
	}
	return l
}

// Log checks that the level matches one or more targets, and
// if so, generates a log record that is added to the Logr queue.
// Arguments are handled in the manner of fmt.Print.
func (logger Logger) Log(lvl Level, args ...interface{}) {
	status := logger.logr.IsLevelEnabled(lvl)
	if status.Enabled {
		rec := NewLogRec(lvl, logger, "", args, status.Stacktrace)
		logger.logr.enqueue(rec)
	}
}

// Trace is a convenience method equivalent to `Log(TraceLevel, args...)`.
func (logger Logger) Trace(args ...interface{}) {
	logger.Log(Trace, args...)
}

// Debug is a convenience method equivalent to `Log(DebugLevel, args...)`.
func (logger Logger) Debug(args ...interface{}) {
	logger.Log(Debug, args...)
}

// Print ensures compatibility with std lib logger.
func (logger Logger) Print(args ...interface{}) {
	logger.Info(args...)
}

// Info is a convenience method equivalent to `Log(InfoLevel, args...)`.
func (logger Logger) Info(args ...interface{}) {
	logger.Log(Info, args...)
}

// Warn is a convenience method equivalent to `Log(WarnLevel, args...)`.
func (logger Logger) Warn(args ...interface{}) {
	logger.Log(Warn, args...)
}

// Error is a convenience method equivalent to `Log(ErrorLevel, args...)`.
func (logger Logger) Error(args ...interface{}) {
	logger.Log(Error, args...)
}

// Fatal is a convenience method equivalent to `Log(FatalLevel, args...)`
// followed by a call to os.Exit(1).
func (logger Logger) Fatal(args ...interface{}) {
	logger.Log(Fatal, args...)
	logger.logr.exit(1)
}

// Panic is a convenience method equivalent to `Log(PanicLevel, args...)`
// followed by a call to panic().
func (logger Logger) Panic(args ...interface{}) {
	logger.Log(Panic, args...)
	panic(fmt.Sprint(args...))
}

//
// Printf style
//

// Logf checks that the level matches one or more targets, and
// if so, generates a log record that is added to the main
// queue (channel). Arguments are handled in the manner of fmt.Printf.
func (logger Logger) Logf(lvl Level, format string, args ...interface{}) {
	status := logger.logr.IsLevelEnabled(lvl)
	if status.Enabled {
		rec := NewLogRec(lvl, logger, format, args, status.Stacktrace)
		logger.logr.enqueue(rec)
	}
}

// Tracef is a convenience method equivalent to `Logf(TraceLevel, args...)`.
func (logger Logger) Tracef(format string, args ...interface{}) {
	logger.Logf(Trace, format, args...)
}

// Debugf is a convenience method equivalent to `Logf(DebugLevel, args...)`.
func (logger Logger) Debugf(format string, args ...interface{}) {
	logger.Logf(Debug, format, args...)
}

// Infof is a convenience method equivalent to `Logf(InfoLevel, args...)`.
func (logger Logger) Infof(format string, args ...interface{}) {
	logger.Logf(Info, format, args...)
}

// Printf ensures compatibility with std lib logger.
func (logger Logger) Printf(format string, args ...interface{}) {
	logger.Infof(format, args...)
}

// Warnf is a convenience method equivalent to `Logf(WarnLevel, args...)`.
func (logger Logger) Warnf(format string, args ...interface{}) {
	logger.Logf(Warn, format, args...)
}

// Errorf is a convenience method equivalent to `Logf(ErrorLevel, args...)`.
func (logger Logger) Errorf(format string, args ...interface{}) {
	logger.Logf(Error, format, args...)
}

// Fatalf is a convenience method equivalent to `Logf(FatalLevel, args...)`
// followed by a call to os.Exit(1).
func (logger Logger) Fatalf(format string, args ...interface{}) {
	logger.Logf(Fatal, format, args...)
	logger.logr.exit(1)
}

// Panicf is a convenience method equivalent to `Logf(PanicLevel, args...)`
// followed by a call to panic().
func (logger Logger) Panicf(format string, args ...interface{}) {
	logger.Logf(Panic, format, args...)
}

//
// Println style
//

// Logln checks that the level matches one or more targets, and
// if so, generates a log record that is added to the main
// queue (channel). Arguments are handled in the manner of fmt.Println.
func (logger Logger) Logln(lvl Level, args ...interface{}) {
	status := logger.logr.IsLevelEnabled(lvl)
	if status.Enabled {
		rec := NewLogRec(lvl, logger, "", args, status.Stacktrace)
		rec.newline = true
		logger.logr.enqueue(rec)
	}
}

// Traceln is a convenience method equivalent to `Logln(TraceLevel, args...)`.
func (logger Logger) Traceln(args ...interface{}) {
	logger.Logln(Trace, args...)
}

// Debugln is a convenience method equivalent to `Logln(DebugLevel, args...)`.
func (logger Logger) Debugln(args ...interface{}) {
	logger.Logln(Debug, args...)
}

// Infoln is a convenience method equivalent to `Logln(InfoLevel, args...)`.
func (logger Logger) Infoln(args ...interface{}) {
	logger.Logln(Info, args...)
}

// Println ensures compatibility with std lib logger.
func (logger Logger) Println(args ...interface{}) {
	logger.Infoln(args...)
}

// Warnln is a convenience method equivalent to `Logln(WarnLevel, args...)`.
func (logger Logger) Warnln(args ...interface{}) {
	logger.Logln(Warn, args...)
}

// Errorln is a convenience method equivalent to `Logln(ErrorLevel, args...)`.
func (logger Logger) Errorln(args ...interface{}) {
	logger.Logln(Error, args...)
}

// Fatalln is a convenience method equivalent to `Logln(FatalLevel, args...)`
// followed by a call to os.Exit(1).
func (logger Logger) Fatalln(args ...interface{}) {
	logger.Logln(Fatal, args...)
	logger.logr.exit(1)
}

// Panicln is a convenience method equivalent to `Logln(PanicLevel, args...)`
// followed by a call to panic().
func (logger Logger) Panicln(args ...interface{}) {
	logger.Logln(Panic, args...)
}
