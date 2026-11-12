// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
)

func TestLogrusWriter(t *testing.T) {
	entry := LogEntry{
		Time:    time.Date(2026, time.November, 3, 8, 54, 8, 903000000, time.UTC),
		Level:   "warn",
		Message: "disk almost full",
		Caller:  "app/server.go:490",
		Fields:  []mlog.Field{{Key: "free", Interface: "1%"}},
	}

	t.Run("without colors", func(t *testing.T) {
		var out bytes.Buffer
		NewLogrusWriter(&out, false).Write(entry)

		assert.Equal(t, `time="2026-11-03T08:54:08.903Z" level=warning msg="disk almost full" caller="app/server.go:490" free="1%"`+"\n", out.String())
	})

	t.Run("with colors", func(t *testing.T) {
		var out bytes.Buffer
		NewLogrusWriter(&out, true).Write(entry)

		assert.Contains(t, out.String(), "\x1b[33mWARN\x1b[0m[2026-11-03T08:54:08.903Z] disk almost full")
		// logrus colors the keys with the level's color
		assert.Contains(t, out.String(), "\x1b[33mcaller\x1b[0m=\"app/server.go:490\"")
	})

	t.Run("strips escape sequences from the entry", func(t *testing.T) {
		injected := LogEntry{
			Time:    entry.Time,
			Level:   "error",
			Message: "invalid token: \x1b]52;c;SGVsbG8=\x07\x1b[2Jdone",
			Caller:  "\x1b]0;title\x07app/server.go:490",
			Fields:  []mlog.Field{{Key: "user\x1b[5m", Interface: "\x1b]0;Fake Title\x07abc"}},
		}

		for _, colors := range []bool{false, true} {
			var out bytes.Buffer
			NewLogrusWriter(&out, colors).Write(injected)

			assert.NotContains(t, out.String(), "\x1b]")
			assert.NotContains(t, out.String(), "\x07")
			assert.NotContains(t, out.String(), "\x1b[2J")
			assert.NotContains(t, out.String(), "\x1b[5m")
			assert.Contains(t, out.String(), "invalid token: done")
			assert.Contains(t, out.String(), "abc")
		}
	})

	t.Run("strips other control characters", func(t *testing.T) {
		var out bytes.Buffer
		NewLogrusWriter(&out, true).Write(LogEntry{Time: entry.Time, Level: "info", Message: "some\x00bytes\x7fhere"})

		assert.NotContains(t, out.String(), "\x00")
		assert.NotContains(t, out.String(), "\x7f")
		assert.Contains(t, out.String(), "somebyteshere")
	})

	t.Run("preserves multi-line messages", func(t *testing.T) {
		var out bytes.Buffer
		NewLogrusWriter(&out, true).Write(LogEntry{Time: entry.Time, Level: "info", Message: "line 1\nline 2"})

		assert.Contains(t, out.String(), "line 1\nline 2")
	})

	t.Run("maps mlog levels logrus doesn't have", func(t *testing.T) {
		for _, tc := range []struct {
			level string
			want  string
		}{
			{"critical", "level=error"},
			{"stdlog", "level=info"},
			{"audit-api", "level=info"},
		} {
			var out bytes.Buffer
			NewLogrusWriter(&out, false).Write(LogEntry{Time: entry.Time, Level: tc.level, Message: "something"})

			assert.Equal(t, 1, strings.Count(out.String(), "\n"), "only the entry is printed: %q", out.String())
			assert.Contains(t, out.String(), tc.want)
			assert.Contains(t, out.String(), "original_level="+tc.level)
			assert.NotContains(t, out.String(), "not a valid logrus Level")
		}
	})

	t.Run("prints a line without a level as is", func(t *testing.T) {
		var out bytes.Buffer
		NewLogrusWriter(&out, true).Write(LogEntry{Message: "not json \x1b[2J"})

		assert.Equal(t, "not json \n", out.String())
	})
}
