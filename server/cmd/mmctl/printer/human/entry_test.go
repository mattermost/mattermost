// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogEntryString(t *testing.T) {
	baseTime := time.Date(2024, time.January, 2, 3, 4, 5, 0, time.UTC)

	t.Run("plain entry renders as expected", func(t *testing.T) {
		entry := LogEntry{
			Time:    baseTime,
			Level:   "info",
			Message: "hello world",
			Caller:  "main.go:10",
			Fields:  []mlog.Field{{Key: "key", Interface: "value"}},
		}

		got := entry.String()
		assert.Contains(t, got, "info")
		assert.Contains(t, got, "main.go:10")
		assert.Contains(t, got, "key=value")
		assert.Contains(t, got, "hello world")
	})

	t.Run("strips ANSI CSI sequences from message", func(t *testing.T) {
		entry := LogEntry{
			Time:    baseTime,
			Level:   "info",
			Message: "\x1b[31mRed Text\x1b[0m",
		}

		got := entry.String()
		assert.NotContains(t, got, "\x1b")
		assert.Contains(t, got, "Red Text")
	})

	t.Run("strips OSC sequences (clipboard hijacking) from message", func(t *testing.T) {
		entry := LogEntry{
			Time:    baseTime,
			Level:   "error",
			Message: "invalid token: Normal text\x1b]52;c;SGVsbG8gV29ybGQ=\x07more text",
		}

		got := entry.String()
		assert.NotContains(t, got, "\x1b")
		assert.NotContains(t, got, "\x07")
		assert.Contains(t, got, "Normal textmore text")
	})

	t.Run("strips escape sequences injected via fields", func(t *testing.T) {
		entry := LogEntry{
			Time:   baseTime,
			Level:  "info",
			Fields: []mlog.Field{{Key: "token", Interface: "\x1b]0;Fake Title\x07abc123"}},
		}

		got := entry.String()
		assert.NotContains(t, got, "\x1b")
		require.Contains(t, got, "token=")
		assert.Contains(t, got, "abc123")
	})

	t.Run("strips other control characters", func(t *testing.T) {
		entry := LogEntry{
			Time:    baseTime,
			Level:   "info",
			Message: "some\x00bytes\x7fhere",
		}

		got := entry.String()
		assert.NotContains(t, got, "\x00")
		assert.NotContains(t, got, "\x7f")
		assert.Contains(t, got, "somebyteshere")
	})

	t.Run("preserves multi-line messages", func(t *testing.T) {
		entry := LogEntry{
			Time:    baseTime,
			Level:   "info",
			Message: "line 1\nline 2",
		}

		got := entry.String()
		assert.Contains(t, got, "line 1\nline 2")
	})
}
