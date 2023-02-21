// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"sync"
)

var (
	globalLogger    LoggerIFace
	muxGlobalLogger sync.RWMutex
)

func InitGlobalLogger(logger LoggerIFace) {
	muxGlobalLogger.Lock()
	defer muxGlobalLogger.Unlock()

	globalLogger = logger
}

func getGlobalLogger() LoggerIFace {
	muxGlobalLogger.RLock()
	defer muxGlobalLogger.RUnlock()

	return globalLogger
}

// IsLevelEnabled returns true only if at least one log target is
// configured to emit the specified log level. Use this check when
// gathering the log info may be expensive.
//
// Note, transformations and serializations done via fields are already
// lazily evaluated and don't require this check beforehand.
func IsLevelEnabled(level Level) bool {
	logger := getGlobalLogger()
	if logger == nil {
		return defaultIsLevelEnabled(level)
	}
	return logger.IsLevelEnabled(level)
}

// Log emits the log record for any targets configured for the specified level.
func Log(level Level, msg string, fields ...Field) {
	logger := getGlobalLogger()
	if logger == nil {
		defaultLog(level, msg, fields...)
		return
	}
	logger.Log(level, msg, fields...)
}

// LogM emits the log record for any targets configured for the specified levels.
// Equivalent to calling `Log` once for each level.
func LogM(levels []Level, msg string, fields ...Field) {
	logger := getGlobalLogger()
	if logger == nil {
		defaultCustomMultiLog(levels, msg, fields...)
		return
	}
	logger.LogM(levels, msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Trace` level.
func Trace(msg string, fields ...Field) {
	logger := getGlobalLogger()
	if logger == nil {
		defaultLog(LvlTrace, msg, fields...)
		return
	}
	logger.Trace(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Debug` level.
func Debug(msg string, fields ...Field) {
	logger := getGlobalLogger()
	if logger == nil {
		defaultLog(LvlDebug, msg, fields...)
		return
	}
	logger.Debug(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Info` level.
func Info(msg string, fields ...Field) {
	logger := getGlobalLogger()
	if logger == nil {
		defaultLog(LvlInfo, msg, fields...)
		return
	}
	logger.Info(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Warn` level.
func Warn(msg string, fields ...Field) {
	logger := getGlobalLogger()
	if logger == nil {
		defaultLog(LvlWarn, msg, fields...)
		return
	}
	logger.Warn(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Error` level.
func Error(msg string, fields ...Field) {
	logger := getGlobalLogger()
	if logger == nil {
		defaultLog(LvlError, msg, fields...)
		return
	}
	logger.Error(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Critical` level.
// DEPRECATED: Either use Error or Fatal.
// Critical level isn't added in mlog/levels.go:StdAll so calling this doesn't
// really work. For now we just call Fatal to atleast print something.
func Critical(msg string, fields ...Field) {
	Fatal(msg, fields...)
}

func Fatal(msg string, fields ...Field) {
	logger := getGlobalLogger()
	if logger == nil {
		defaultLog(LvlFatal, msg, fields...)
		return
	}
	logger.Fatal(msg, fields...)
}
