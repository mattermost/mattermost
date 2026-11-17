// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseLogMessage(t *testing.T) {
	t.Run("reads the time from mlog's timestamp", func(t *testing.T) {
		entry := ParseLogMessage(`{"timestamp":"2026-11-03 08:54:08.903 Z","level":"info","msg":"listening","caller":"app/server.go:490","request_id":"abc"}`)

		assert.True(t, entry.Time.Equal(time.Date(2026, time.November, 3, 8, 54, 8, 903000000, time.UTC)), "got %s", entry.Time)
		assert.Equal(t, "info", entry.Level)
		assert.Equal(t, "listening", entry.Message)
		assert.Equal(t, "app/server.go:490", entry.Caller)
		assert.Equal(t, []mlog.Field{{Key: "request_id", Interface: "abc"}}, entry.Fields)
	})

	t.Run("reads a timestamp with an offset", func(t *testing.T) {
		entry := ParseLogMessage(`{"timestamp":"2026-11-03 09:54:08.903 +01:00","level":"info","msg":"listening"}`)

		assert.True(t, entry.Time.Equal(time.Date(2026, time.November, 3, 8, 54, 8, 903000000, time.UTC)), "got %s", entry.Time)
	})

	t.Run("keeps a timestamp it can't read as a field", func(t *testing.T) {
		for _, line := range []string{
			`{"timestamp":"yesterday","level":"info","msg":"listening"}`,
			`{"timestamp":42,"level":"info","msg":"listening"}`,
		} {
			entry := ParseLogMessage(line)

			assert.True(t, entry.Time.IsZero())
			require.Len(t, entry.Fields, 1, line)
			assert.Equal(t, "timestamp", entry.Fields[0].Key)
		}
	})

	t.Run("keeps the digits of numbers", func(t *testing.T) {
		entry := ParseLogMessage(`{"level":"info","msg":"listening","post_count":12345678901234567890}`)

		require.Len(t, entry.Fields, 1)
		assert.Equal(t, json.Number("12345678901234567890"), entry.Fields[0].Interface)
	})

	t.Run("still reads the older ts", func(t *testing.T) {
		entry := ParseLogMessage(`{"level":"info","ts":1573516747,"msg":"listening"}`)

		assert.True(t, entry.Time.Equal(time.Unix(1573516747, 0)))
		assert.Empty(t, entry.Fields)
	})
}
