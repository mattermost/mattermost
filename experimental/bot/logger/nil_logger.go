package logger

type nilLogger struct{}

// NewNilLogger returns a logger that performs no action.
func NewNilLogger() Logger {
	return &nilLogger{}
}

func (l *nilLogger) With(logContext LogContext) Logger         { return l }
func (l *nilLogger) Context() LogContext                       { return nil }
func (l *nilLogger) Timed() Logger                             { return l }
func (l *nilLogger) Debugf(format string, args ...interface{}) {}
func (l *nilLogger) Errorf(format string, args ...interface{}) {}
func (l *nilLogger) Infof(format string, args ...interface{})  {}
func (l *nilLogger) Warnf(format string, args ...interface{})  {}
