// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"bytes"
	"io"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/mattermost/logr/v2"
	"github.com/mattermost/logr/v2/formatters"
	"github.com/mattermost/logr/v2/targets"
)

// CreateTestLogger creates a logger for unit tests, using the `TB.Log`
func CreateTestLogger(tb testing.TB, writer io.Writer, levels ...Level) *Logger {
	logger, _ := NewLogger()

	filter := logr.NewCustomFilter(levels...)
	formatter := &formatters.Plain{}

	if tb != nil {
		testtarget := newTestingTarget(tb)
		if err := logger.log.Logr().AddTarget(testtarget, "_testTB", filter, formatter, 1000); err != nil {
			tb.Fail()
			return nil
		}
	}

	if writer != nil {
		target := targets.NewWriterTarget(writer)
		if err := logger.log.Logr().AddTarget(target, "_testWriter", filter, formatter, 1000); err != nil {
			tb.Fail()
			return nil
		}
	}
	return logger
}

func AddWriterTarget(logger *Logger, w io.Writer, useJSON bool, levels ...Level) error {
	filter := logr.NewCustomFilter(levels...)

	var formatter logr.Formatter
	if useJSON {
		formatter = &formatters.JSON{EnableCaller: true}
	} else {
		formatter = &formatters.Plain{EnableCaller: true}
	}

	target := targets.NewWriterTarget(w)
	return logger.log.Logr().AddTarget(target, "_testWriter", filter, formatter, 1000)
}

// CreateConsoleTestLogger creates a logger for unit tests. Log records are output to `os.Stdout`.
// Logs can also be mirrored to the optional `io.Writer`.
func CreateConsoleTestLogger(useJSON bool, level Level) *Logger {
	logger, _ := NewLogger()

	filter := logr.StdFilter{
		Lvl:        level,
		Stacktrace: LvlPanic,
	}

	var formatter logr.Formatter
	if useJSON {
		formatter = &formatters.JSON{EnableCaller: true}
	} else {
		formatter = &formatters.Plain{EnableCaller: true}
	}

	target := targets.NewWriterTarget(os.Stdout)
	if err := logger.log.Logr().AddTarget(target, "_testcon", filter, formatter, 1000); err != nil {
		panic(err)
	}
	return logger
}

// testingTarget is a simple log target that writes to the testing log.
type testingTarget struct {
	mux sync.Mutex
	tb  testing.TB
}

func newTestingTarget(tb testing.TB) *testingTarget {
	return &testingTarget{
		tb: tb,
	}
}

// Init is called once to initialize the target.
func (tt *testingTarget) Init() error {
	return nil
}

// Write outputs bytes to this file target.
func (tt *testingTarget) Write(p []byte, rec *logr.LogRec) (int, error) {
	tt.mux.Lock()
	defer tt.mux.Unlock()

	if tt.tb != nil {
		tt.tb.Helper()
		tt.tb.Log(strings.TrimSpace(string(p)))
	}
	return len(p), nil
}

// Shutdown is called once to free/close any resources.
// Target queue is already drained when this is called.
func (tt *testingTarget) Shutdown() error {
	tt.mux.Lock()
	defer tt.mux.Unlock()

	tt.tb = nil
	return nil
}

// Buffer provides a thread-safe buffer useful for logging to memory in unit tests.
type Buffer struct {
	buf bytes.Buffer
	mux sync.Mutex
}

func (b *Buffer) Read(p []byte) (n int, err error) {
	b.mux.Lock()
	defer b.mux.Unlock()
	return b.buf.Read(p)
}
func (b *Buffer) Write(p []byte) (n int, err error) {
	b.mux.Lock()
	defer b.mux.Unlock()
	return b.buf.Write(p)
}
func (b *Buffer) String() string {
	b.mux.Lock()
	defer b.mux.Unlock()
	return b.buf.String()
}
