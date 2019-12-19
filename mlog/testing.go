// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"strings"
	"testing"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// testingWriter is an io.Writer that writes through t.Log
type testingWriter struct {
	tb testing.TB
}

func (tw *testingWriter) Write(b []byte) (int, error) {
	tw.tb.Log(strings.TrimSpace(string(b)))
	return len(b), nil
}

// NewTestingLogger creates a Logger that proxies logs through a testing interface.
// This allows tests that spin up App instances to avoid spewing logs unless the test fails or -verbose is specified.
func NewTestingLogger(tb testing.TB) *Logger {
	logWriter := &testingWriter{tb}
	logWriterSync := zapcore.AddSync(logWriter)

	testingLogger := &Logger{
		consoleLevel: zap.NewAtomicLevelAt(getZapLevel("debug")),
		fileLevel:    zap.NewAtomicLevelAt(getZapLevel("info")),
	}

	logWriterCore := zapcore.NewCore(makeEncoder(true), logWriterSync, testingLogger.consoleLevel)

	testingLogger.zap = zap.New(logWriterCore,
		zap.AddCaller(),
	)
	return testingLogger
}
