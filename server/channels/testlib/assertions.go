// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"encoding/json"
	"io"
	"testing"
)

// AssertLog asserts that a JSON-encoded buffer of logs contains one with the given level and message.
func AssertLog(t *testing.T, logs io.Reader, level, message string) {
	dec := json.NewDecoder(logs)
	for {
		var log struct {
			Level string
			Msg   string
		}
		if err := dec.Decode(&log); err == io.EOF {
			break
		} else if err != nil {
			t.Logf("Error decoding log entry: %s", err)
			continue
		}

		if log.Level == level && log.Msg == message {
			return
		}
	}

	t.Fatalf("failed to find %s log message: %s", level, message)
}

// AssertNoLog asserts that a JSON-encoded buffer of logs does not contains one with the given level and message.
func AssertNoLog(t *testing.T, logs io.Reader, level, message string) {
	dec := json.NewDecoder(logs)
	for {
		var log struct {
			Level string
			Msg   string
		}
		if err := dec.Decode(&log); err == io.EOF {
			break
		} else if err != nil {
			t.Logf("Error decoding log entry: %s", err)
			continue
		}

		if log.Level == level && log.Msg == message {
			t.Fatalf("found %s log message: %s", level, message)
			return
		}
	}
}
