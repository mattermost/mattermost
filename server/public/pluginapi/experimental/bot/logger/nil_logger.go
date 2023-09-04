package logger

type nilLogger struct{}

// NewNilLogger returns a logger that performs no action.
func NewNilLogger() Logger {
	return &nilLogger{}
}

func (l *nilLogger) With(LogContext) Logger        { return l }
func (l *nilLogger) WithError(error) Logger        { return l }
func (l *nilLogger) Context() LogContext           { return nil }
func (l *nilLogger) Timed() Logger                 { return l }
func (l *nilLogger) Debugf(string, ...interface{}) {}
func (l *nilLogger) Errorf(string, ...interface{}) {}
func (l *nilLogger) Infof(string, ...interface{})  {}
func (l *nilLogger) Warnf(string, ...interface{})  {}
