package analytics

import (
	"log"
	"os"
)

// Instances of types implementing this interface can be used to define where
// the analytics client logs are written.
type Logger interface {

	// Analytics clients call this method to log regular messages about the
	// operations they perform.
	// Messages logged by this method are usually tagged with an `INFO` log
	// level in common logging libraries.
	Logf(format string, args ...interface{})

	// Analytics clients call this method to log errors they encounter while
	// sending events to the backend servers.
	// Messages logged by this method are usually tagged with an `ERROR` log
	// level in common logging libraries.
	Errorf(format string, args ...interface{})
}

// This function instantiate an object that statisfies the analytics.Logger
// interface and send logs to standard logger passed as argument.
func StdLogger(logger *log.Logger) Logger {
	return stdLogger{
		logger: logger,
	}
}

type stdLogger struct {
	logger *log.Logger
}

func (l stdLogger) Logf(format string, args ...interface{}) {
	l.logger.Printf("INFO: "+format, args...)
}

func (l stdLogger) Errorf(format string, args ...interface{}) {
	l.logger.Printf("ERROR: "+format, args...)
}

func newDefaultLogger() Logger {
	return StdLogger(log.New(os.Stderr, "segment ", log.LstdFlags))
}
