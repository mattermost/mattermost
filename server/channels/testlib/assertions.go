// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"encoding/json"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// AssertLog asserts that a JSON-encoded buffer of logs contains one with the given level and message.
func AssertLog(t *testing.T, logs io.Reader, level, message string) {
	t.Helper()
	if !hasMsg(t, logs, level, message) {
		assert.Failf(t, "failed to find", "Expected log_level: %s, log_message: %s", level, message)
	}
}

// AssertNoLog asserts that a JSON-encoded buffer of logs does not contains one with the given level and message.
func AssertNoLog(t *testing.T, logs io.Reader, level, message string) {
	t.Helper()
	if hasMsg(t, logs, level, message) {
		assert.Failf(t, "found", "Not expected log_level: %s log_message: %s", level, message)
	}
}

// CheckLog checks whether a JSON-encoded buffer of logs contain the given
// message at the level or not.
func CheckLog(t *testing.T, logs io.Reader, level, message string) bool {
	return hasMsg(t, logs, level, message)
}

func hasMsg(t *testing.T, logs io.Reader, level, message string) bool {
	dec := json.NewDecoder(logs)
	for {
		var entry struct {
			Level string
			Msg   string
		}
		err := dec.Decode(&entry)
		if err == io.EOF {
			break
		}
		require.NoError(t, err, "Error decoding log entry")

		if entry.Level == "" || entry.Msg == "" {
			t.Logf("Invalid log entry: %s", entry)
			continue
		}

		//if log.Level == level && log.Msg == message {
		if entry.Msg == message {
			return true
		}
	}
	return false
}

type LogEntry struct {
	Level string `json:"level"`
	Msg   string `json:"msg"`
}

// ParseLogEntries parses a JSON-encoded buffer of logs and returns a list of log entries.
func ParseLogEntries(t *testing.T, logs io.Reader) []LogEntry {
	t.Helper()
	var entries []LogEntry

	dec := json.NewDecoder(logs)
	for {
		var entry LogEntry
		err := dec.Decode(&entry)
		if err == io.EOF {
			break
		}
		require.NoError(t, err, "Error decoding log entry")

		if entry.Level == "" || entry.Msg == "" {
			t.Logf("Invalid log entry: %s", entry)
			continue
		}

		entries = append(entries, entry)
	}

	return entries
}
