// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

import "fmt"

type mlog struct{}

func (m *mlog) Debug(msg string, fields ...interface{}) {}
func (m *mlog) Info(msg string, fields ...interface{})  {}
func (m *mlog) Warn(msg string, fields ...interface{})  {}
func (m *mlog) Error(msg string, fields ...interface{}) {}
func (m *mlog) Critical(msg string, fields ...interface{}) {}
func (m *mlog) String(key, val string) interface{} { return nil }

var Mlog = &mlog{}

func validStructuredLogging() {
	// Valid: using structured logging correctly
	mlog := Mlog
	mlog.Debug("User logged in", mlog.String("user_id", "123"))
	mlog.Info("Server started", mlog.String("port", "8065"))
	mlog.Warn("High memory usage", mlog.String("usage", "90%"))
	mlog.Error("Database connection failed", mlog.String("error", "timeout"))
	mlog.Critical("System failure", mlog.String("component", "auth"))

	// Valid: simple string messages without formatting
	mlog.Debug("Simple message")
	mlog.Info("Another message")

	// Valid: fmt outside of mlog calls
	msg := fmt.Sprintf("User %s logged in", "john")
	_ = msg
}

func invalidStructuredLogging() {
	mlog := Mlog

	// Invalid: using fmt.Sprintf inside mlog.Debug
	mlog.Debug(fmt.Sprintf("User %s logged in", "john")) // want "Using fmt inside mlog function, use structured logging instead"

	// Invalid: using fmt.Sprintf inside mlog.Info
	mlog.Info(fmt.Sprintf("Server started on port %d", 8065)) // want "Using fmt inside mlog function, use structured logging instead"

	// Invalid: using fmt.Sprintf inside mlog.Warn
	mlog.Warn(fmt.Sprintf("Memory usage: %d%%", 90)) // want "Using fmt inside mlog function, use structured logging instead"

	// Invalid: using fmt.Sprintf inside mlog.Error
	mlog.Error(fmt.Sprintf("Failed to connect: %v", "timeout")) // want "Using fmt inside mlog function, use structured logging instead"

	// Invalid: using fmt.Sprintf inside mlog.Critical
	mlog.Critical(fmt.Sprintf("System failure in %s", "auth")) // want "Using fmt inside mlog function, use structured logging instead"

	// Invalid: using fmt.Sprint inside mlog calls
	mlog.Debug(fmt.Sprint("User logged in")) // want "Using fmt inside mlog function, use structured logging instead"
	mlog.Info(fmt.Sprint("Server started")) // want "Using fmt inside mlog function, use structured logging instead"
}

func edgeCases() {
	mlog := Mlog

	// Valid: fmt.Sprintf in subsequent arguments (not first)
	mlog.Debug("Message", mlog.String("key", fmt.Sprintf("value %d", 123)))

	// Valid: different function names
	mlog.Debug("Message")

	// Valid: no arguments
	mlog.Debug("")
}
