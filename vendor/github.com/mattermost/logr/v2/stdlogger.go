package logr

import (
	"log"
	"os"
	"strings"
)

// NewStdLogger creates a standard logger backed by a Logr instance.
// All log records are emitted with the specified log level.
func NewStdLogger(level Level, logger Logger) *log.Logger {
	adapter := newStdLogAdapter(logger, level)
	return log.New(adapter, "", 0)
}

// RedirectStdLog redirects output from the standard library's package-global logger
// to this logger at the specified level and with zero or more Field's. Since Logr already
// handles caller annotations, timestamps, etc., it automatically disables the standard
// library's annotations and prefixing.
// A function is returned that restores the original prefix and flags and resets the standard
// library's output to os.Stderr.
func (lgr *Logr) RedirectStdLog(level Level, fields ...Field) func() {
	flags := log.Flags()
	prefix := log.Prefix()
	log.SetFlags(0)
	log.SetPrefix("")

	logger := lgr.NewLogger().With(fields...)
	adapter := newStdLogAdapter(logger, level)
	log.SetOutput(adapter)

	return func() {
		log.SetFlags(flags)
		log.SetPrefix(prefix)
		log.SetOutput(os.Stderr)
	}
}

type stdLogAdapter struct {
	logger Logger
	level  Level
}

func newStdLogAdapter(logger Logger, level Level) *stdLogAdapter {
	return &stdLogAdapter{
		logger: logger,
		level:  level,
	}
}

// Write implements io.Writer
func (a *stdLogAdapter) Write(p []byte) (int, error) {
	s := strings.TrimSpace(string(p))
	a.logger.Log(a.level, s)
	return len(p), nil
}
