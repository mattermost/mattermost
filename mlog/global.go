package mlog

import (
	"go.uber.org/zap/zapcore"
)

var globalLogger *Logger

func InitGlobalLogger(logger *Logger) {
	globalLogger = logger
	Debug = globalLogger.Debug
	Info = globalLogger.Info
	Warn = globalLogger.Warn
	Error = globalLogger.Error
	Critical = globalLogger.Critical
}

type LogFunc func(string, ...Field)

// DON'T USE THIS Modify the level on the app logger
func GloballyDisableDebugLogForTest() {
	globalLogger.consoleLevel.SetLevel(zapcore.ErrorLevel)
}

// DON'T USE THIS Modify the level on the app logger
func GloballyEnableDebugLogForTest() {
	globalLogger.consoleLevel.SetLevel(zapcore.DebugLevel)
}

var Debug LogFunc
var Info LogFunc
var Warn LogFunc
var Error LogFunc
var Critical LogFunc
