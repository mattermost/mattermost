// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"io"
	"strings"
	"sync"
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
func NewTestingLogger(tb testing.TB, writer io.Writer) *Logger {
	logWriter := &testingWriter{tb}
	multiWriter := io.MultiWriter(logWriter, writer)
	logWriterSync := zapcore.AddSync(multiWriter)

	testingLogger := &Logger{
		consoleLevel: zap.NewAtomicLevelAt(getZapLevel("debug")),
		fileLevel:    zap.NewAtomicLevelAt(getZapLevel("info")),
		logrLogger:   newLogr(),
		mutex:        &sync.RWMutex{},
	}

	logWriterCore := zapcore.NewCore(makeEncoder(true, false), zapcore.Lock(logWriterSync), testingLogger.consoleLevel)

	testingLogger.zap = zap.New(logWriterCore,
		zap.AddCaller(),
	)
	return testingLogger
}
