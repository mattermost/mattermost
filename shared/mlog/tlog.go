// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"bytes"
	"io"
	"os"
	"sync"

	"github.com/mattermost/logr/v2"
	"github.com/mattermost/logr/v2/formatters"
	"github.com/mattermost/logr/v2/targets"
)

// AddWriterTarget adds a simple io.Writer target to an existing Logger.
// The `io.Writer` can be a buffer which is useful for testing.
// When adding a buffer to collect logs make sure to use `mlog.Buffer` which is
// a thread safe version of `bytes.Buffer`.
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
