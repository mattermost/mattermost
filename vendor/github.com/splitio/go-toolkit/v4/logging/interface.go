package logging

// LoggerInterface ...
// If a custom logger object is to be used, it should comply with the following
// interface. (Standard go-lang library log.Logger.Println method signature)
type LoggerInterface interface {
	Error(msg ...interface{})
	Warning(msg ...interface{})
	Info(msg ...interface{})
	Debug(msg ...interface{})
	Verbose(msg ...interface{})
}
