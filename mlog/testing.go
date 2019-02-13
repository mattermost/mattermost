// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mlog

import (
	"testing"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// testingWriter is an io.Writer that writes through t.Log
type testingWriter struct {
	tb testing.TB
}

func (tw *testingWriter) Write(b []byte) (int, error) {
	tw.tb.Log(string(b))
	return len(b), nil
}

func NewTestingLogger(tb testing.TB) *Logger {
	logWriter := &testingWriter{tb}
	logWriterSync := zapcore.AddSync(logWriter)

	testingLogger := &Logger{
		consoleLevel: zap.NewAtomicLevelAt(getZapLevel("debug")),
		fileLevel:    zap.NewAtomicLevelAt(getZapLevel("info")),
	}

	logWriterCore := zapcore.NewCore(makeEncoder(true), logWriterSync, testingLogger.consoleLevel)

	testingLogger.zap = zap.New(logWriterCore,
		zap.AddCallerSkip(1),
		zap.AddCaller(),
	)
	return testingLogger
}
