package mlog

var globalLogger *Logger

func initGlobalLogger() {
	globalLogger = NewLogger(&LoggerConfiguration{
		EnableConsole: true,
		ConsoleLevel:  "debug",
		ConsoleJson:   true,
	})
}

func init() {
	initGlobalLogger()
	Debug = globalLogger.Debug
	Info = globalLogger.Info
	Warn = globalLogger.Warn
	Error = globalLogger.Error
	Critical = globalLogger.Critical
}

type LogFunc func(string, ...Field)

var Debug LogFunc
var Info LogFunc
var Warn LogFunc
var Error LogFunc
var Critical LogFunc
