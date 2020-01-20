// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"bytes"
	"strings"
	"testing"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// testingWriter is an io.Writer that writes through t.Log
type testingWriter struct {
	tb     testing.TB
	buffer *bytes.Buffer
}

func (tw *testingWriter) Write(b []byte) (int, error) {
	tw.tb.Log(strings.TrimSpace(string(b)))
	tw.buffer.Write(b)
	return len(b), nil
}

// NewTestingLogger creates a Logger that proxies logs through a testing interface.
// This allows tests that spin up App instances to avoid spewing logs unless the test fails or -verbose is specified.
func NewTestingLogger(tb testing.TB) *Logger {
	buffer := &bytes.Buffer{}
	logWriter := &testingWriter{tb, buffer}
	logWriterSync := zapcore.AddSync(logWriter)

	testingLogger := &Logger{
		consoleLevel: zap.NewAtomicLevelAt(getZapLevel("debug")),
		fileLevel:    zap.NewAtomicLevelAt(getZapLevel("info")),
	}

	logWriterCore := zapcore.NewCore(makeEncoder(true), logWriterSync, testingLogger.consoleLevel)

	testingLogger.zap = zap.New(logWriterCore,
		zap.AddCaller(),
	)
	testingLogger.SetBuffer(buffer)
	return testingLogger
}
