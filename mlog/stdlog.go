// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mlog

import (
	"bytes"
	"strings"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Implementation of zapcore.Core to interpret log messages from a standard logger
// and translate the levels to zapcore levels.
type stdLogLevelInterpreterCore struct {
	wrappedCore zapcore.Core
}

func stdLogInterpretZapEntry(entry zapcore.Entry) zapcore.Entry {
	message := entry.Message
	if strings.Index(message, "[DEBUG]") == 0 {
		entry.Level = zapcore.DebugLevel
		entry.Message = message[7:]
	} else if strings.Index(message, "[DEBG]") == 0 {
		entry.Level = zapcore.DebugLevel
		entry.Message = message[6:]
	} else if strings.Index(message, "[WARN]") == 0 {
		entry.Level = zapcore.WarnLevel
		entry.Message = message[6:]
	} else if strings.Index(message, "[ERROR]") == 0 {
		entry.Level = zapcore.ErrorLevel
		entry.Message = message[7:]
	} else if strings.Index(message, "[EROR]") == 0 {
		entry.Level = zapcore.ErrorLevel
		entry.Message = message[6:]
	} else if strings.Index(message, "[ERR]") == 0 {
		entry.Level = zapcore.ErrorLevel
		entry.Message = message[5:]
	} else if strings.Index(message, "[INFO]") == 0 {
		entry.Level = zapcore.InfoLevel
		entry.Message = message[6:]
	}
	return entry
}

func (s *stdLogLevelInterpreterCore) Enabled(lvl zapcore.Level) bool {
	return s.wrappedCore.Enabled(lvl)
}

func (s *stdLogLevelInterpreterCore) With(fields []zapcore.Field) zapcore.Core {
	return s.wrappedCore.With(fields)
}

func (s *stdLogLevelInterpreterCore) Check(entry zapcore.Entry, checkedEntry *zapcore.CheckedEntry) *zapcore.CheckedEntry {
	entry = stdLogInterpretZapEntry(entry)
	return s.wrappedCore.Check(entry, checkedEntry)
}

func (s *stdLogLevelInterpreterCore) Write(entry zapcore.Entry, fields []zapcore.Field) error {
	entry = stdLogInterpretZapEntry(entry)
	return s.wrappedCore.Write(entry, fields)
}

func (s *stdLogLevelInterpreterCore) Sync() error {
	return s.wrappedCore.Sync()
}

func getStdLogOption() zap.Option {
	return zap.WrapCore(
		func(core zapcore.Core) zapcore.Core {
			return &stdLogLevelInterpreterCore{core}
		},
	)
}

type loggerWriter struct {
	logFunc func(msg string, fields ...Field)
}

func (l *loggerWriter) Write(p []byte) (int, error) {
	trimmed := string(bytes.TrimSpace(p))
	for _, line := range strings.Split(trimmed, "\n") {
		l.logFunc(string(line))
	}
	return len(p), nil
}
