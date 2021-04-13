// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"context"
	"log"
	"sync/atomic"

	"github.com/mattermost/logr"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var globalLogger *Logger

func InitGlobalLogger(logger *Logger) {
	// Clean up previous instance.
	if globalLogger != nil && globalLogger.logrLogger != nil {
		globalLogger.logrLogger.Logr().Shutdown()
	}
	glob := *logger
	glob.zap = glob.zap.WithOptions(zap.AddCallerSkip(1))
	globalLogger = &glob
	IsLevelEnabled = globalLogger.IsLevelEnabled
	Debug = globalLogger.Debug
	Info = globalLogger.Info
	Warn = globalLogger.Warn
	Error = globalLogger.Error
	Critical = globalLogger.Critical
	Log = globalLogger.Log
	LogM = globalLogger.LogM
	Flush = globalLogger.Flush
	ConfigAdvancedLogging = globalLogger.ConfigAdvancedLogging
	ShutdownAdvancedLogging = globalLogger.ShutdownAdvancedLogging
	AddTarget = globalLogger.AddTarget
	RemoveTargets = globalLogger.RemoveTargets
	EnableMetrics = globalLogger.EnableMetrics
}

// logWriterFunc provides access to mlog via io.Writer, so the standard logger
// can be redirected to use mlog and whatever targets are defined.
type logWriterFunc func([]byte) (int, error)

func (lw logWriterFunc) Write(p []byte) (int, error) {
	return lw(p)
}

func RedirectStdLog(logger *Logger) {
	if atomic.LoadInt32(&disableZap) == 0 {
		zap.RedirectStdLogAt(logger.zap.With(zap.String("source", "stdlog")).WithOptions(zap.AddCallerSkip(-2)), zapcore.ErrorLevel)
		return
	}

	writer := func(p []byte) (int, error) {
		Log(LvlStdLog, string(p))
		return len(p), nil
	}
	log.SetOutput(logWriterFunc(writer))
}

type IsLevelEnabledFunc func(LogLevel) bool
type LogFunc func(string, ...Field)
type LogFuncCustom func(LogLevel, string, ...Field)
type LogFuncCustomMulti func([]LogLevel, string, ...Field)
type FlushFunc func(context.Context) error
type ConfigFunc func(cfg LogTargetCfg) error
type ShutdownFunc func(context.Context) error
type AddTargetFunc func(...logr.Target) error
type RemoveTargetsFunc func(context.Context, func(TargetInfo) bool) error
type EnableMetricsFunc func(logr.MetricsCollector) error

// DON'T USE THIS Modify the level on the app logger
func GloballyDisableDebugLogForTest() {
	globalLogger.consoleLevel.SetLevel(zapcore.ErrorLevel)
}

// DON'T USE THIS Modify the level on the app logger
func GloballyEnableDebugLogForTest() {
	globalLogger.consoleLevel.SetLevel(zapcore.DebugLevel)
}

var IsLevelEnabled IsLevelEnabledFunc = defaultIsLevelEnabled
var Debug LogFunc = defaultDebugLog
var Info LogFunc = defaultInfoLog
var Warn LogFunc = defaultWarnLog
var Error LogFunc = defaultErrorLog
var Critical LogFunc = defaultCriticalLog
var Log LogFuncCustom = defaultCustomLog
var LogM LogFuncCustomMulti = defaultCustomMultiLog
var Flush FlushFunc = defaultFlush

var ConfigAdvancedLogging ConfigFunc = defaultAdvancedConfig
var ShutdownAdvancedLogging ShutdownFunc = defaultAdvancedShutdown
var AddTarget AddTargetFunc = defaultAddTarget
var RemoveTargets RemoveTargetsFunc = defaultRemoveTargets
var EnableMetrics EnableMetricsFunc = defaultEnableMetrics
