package logr

import (
	"fmt"
)

// Sugar provides a less structured API for logging.
type Sugar struct {
	logger Logger
}

func (s Sugar) sugarLog(lvl Level, msg string, args ...interface{}) {
	if s.logger.IsLevelEnabled(lvl) {
		fields := make([]Field, 0, len(args))
		for _, arg := range args {
			fields = append(fields, Any("", arg))
		}
		s.logger.Log(lvl, msg, fields...)
	}
}

// Trace is a convenience method equivalent to `Log(TraceLevel, msg, args...)`.
func (s Sugar) Trace(msg string, args ...interface{}) {
	s.sugarLog(Trace, msg, args...)
}

// Debug is a convenience method equivalent to `Log(DebugLevel, msg, args...)`.
func (s Sugar) Debug(msg string, args ...interface{}) {
	s.sugarLog(Debug, msg, args...)
}

// Print ensures compatibility with std lib logger.
func (s Sugar) Print(msg string, args ...interface{}) {
	s.Info(msg, args...)
}

// Info is a convenience method equivalent to `Log(InfoLevel, msg, args...)`.
func (s Sugar) Info(msg string, args ...interface{}) {
	s.sugarLog(Info, msg, args...)
}

// Warn is a convenience method equivalent to `Log(WarnLevel, msg, args...)`.
func (s Sugar) Warn(msg string, args ...interface{}) {
	s.sugarLog(Warn, msg, args...)
}

// Error is a convenience method equivalent to `Log(ErrorLevel, msg, args...)`.
func (s Sugar) Error(msg string, args ...interface{}) {
	s.sugarLog(Error, msg, args...)
}

// Fatal is a convenience method equivalent to `Log(FatalLevel, msg, args...)`
func (s Sugar) Fatal(msg string, args ...interface{}) {
	s.sugarLog(Fatal, msg, args...)
}

// Panic is a convenience method equivalent to `Log(PanicLevel, msg, args...)`
func (s Sugar) Panic(msg string, args ...interface{}) {
	s.sugarLog(Panic, msg, args...)
}

//
// Printf style
//

// Logf checks that the level matches one or more targets, and
// if so, generates a log record that is added to the main
// queue (channel). Arguments are handled in the manner of fmt.Printf.
func (s Sugar) Logf(lvl Level, format string, args ...interface{}) {
	if s.logger.IsLevelEnabled(lvl) {
		var msg string
		if format == "" {
			msg = fmt.Sprint(args...)
		} else {
			msg = fmt.Sprintf(format, args...)
		}
		s.logger.Log(lvl, msg)
	}
}

// Tracef is a convenience method equivalent to `Logf(TraceLevel, args...)`.
func (s Sugar) Tracef(format string, args ...interface{}) {
	s.Logf(Trace, format, args...)
}

// Debugf is a convenience method equivalent to `Logf(DebugLevel, args...)`.
func (s Sugar) Debugf(format string, args ...interface{}) {
	s.Logf(Debug, format, args...)
}

// Infof is a convenience method equivalent to `Logf(InfoLevel, args...)`.
func (s Sugar) Infof(format string, args ...interface{}) {
	s.Logf(Info, format, args...)
}

// Printf ensures compatibility with std lib logger.
func (s Sugar) Printf(format string, args ...interface{}) {
	s.Infof(format, args...)
}

// Warnf is a convenience method equivalent to `Logf(WarnLevel, args...)`.
func (s Sugar) Warnf(format string, args ...interface{}) {
	s.Logf(Warn, format, args...)
}

// Errorf is a convenience method equivalent to `Logf(ErrorLevel, args...)`.
func (s Sugar) Errorf(format string, args ...interface{}) {
	s.Logf(Error, format, args...)
}

// Fatalf is a convenience method equivalent to `Logf(FatalLevel, args...)`
func (s Sugar) Fatalf(format string, args ...interface{}) {
	s.Logf(Fatal, format, args...)
}

// Panicf is a convenience method equivalent to `Logf(PanicLevel, args...)`
func (s Sugar) Panicf(format string, args ...interface{}) {
	s.Logf(Panic, format, args...)
}
