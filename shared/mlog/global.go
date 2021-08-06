// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"sync/atomic"
)

var (
	globalLogger *Logger

	useDefaultLogger int32 = 1
)

func InitGlobalLogger(logger *Logger) {
	// Clean up previous instance.
	if globalLogger != nil {
		globalLogger.Shutdown()
	}
	globalLogger = logger

	if logger == nil {
		atomic.StoreInt32(&useDefaultLogger, 1)
		return
	}

	atomic.StoreInt32(&useDefaultLogger, 0)
}

// IsLevelEnabled returns true only if at least one log target is
// configured to emit the specified log level. Use this check when
// gathering the log info may be expensive.
//
// Note, transformations and serializations done via fields are already
// lazily evaluated and don't require this check beforehand.
func IsLevelEnabled(level Level) bool {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		return globalLogger.IsLevelEnabled(level)
	}
	return defaultIsLevelEnabled(level)
}

// Log emits the log record for any targets configured for the specified level.
func Log(level Level, msg string, fields ...Field) {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		globalLogger.Log(level, msg, fields...)
		return
	}
	defaultCustomLog(level, msg, fields...)
}

// LogM emits the log record for any targets configured for the specified levels.
// Equivalent to calling `Log` once for each level.
func LogM(levels []Level, msg string, fields ...Field) {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		globalLogger.LogM(levels, msg, fields...)
		return
	}
	defaultCustomMultiLog(levels, msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Trace` level.
func Trace(msg string, fields ...Field) {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		globalLogger.Trace(msg, fields...)
		return
	}
	defaultTraceLog(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Debug` level.
func Debug(msg string, fields ...Field) {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		globalLogger.Debug(msg, fields...)
		return
	}
	defaultDebugLog(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Info` level.
func Info(msg string, fields ...Field) {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		globalLogger.Info(msg, fields...)
		return
	}
	defaultInfoLog(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Warn` level.
func Warn(msg string, fields ...Field) {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		globalLogger.Warn(msg, fields...)
		return
	}
	defaultWarnLog(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Error` level.
func Error(msg string, fields ...Field) {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		globalLogger.Error(msg, fields...)
		return
	}
	defaultErrorLog(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Critical` level.
func Critical(msg string, fields ...Field) {
	if atomic.LoadInt32(&useDefaultLogger) == 0 {
		globalLogger.Critical(msg, fields...)
		return
	}
	defaultCriticalLog(msg, fields...)
}
