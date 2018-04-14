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
}

var Debug = globalLogger.Debug
var Info = globalLogger.Info
var Warn = globalLogger.Warn
var Error = globalLogger.Error
var Critical = globalLogger.Critical
