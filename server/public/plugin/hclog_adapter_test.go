// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestHclogArgsToFields(t *testing.T) {
	t.Run("nil args returns nil fields", func(t *testing.T) {
		fields := hclogArgsToFields("extras", nil)
		assert.Nil(t, fields)
	})

	t.Run("empty args returns nil fields", func(t *testing.T) {
		fields := hclogArgsToFields("extras", []any{})
		assert.Nil(t, fields)
	})

	t.Run("even number of args produces key-value fields", func(t *testing.T) {
		fields := hclogArgsToFields("extras", []any{"user_id", "abc123", "channel", "town-square"})
		require.Len(t, fields, 2)
		assert.Equal(t, "user_id", fields[0].Key)
		assert.Equal(t, "channel", fields[1].Key)
	})

	t.Run("odd number of args stores remainder in extrasKey", func(t *testing.T) {
		fields := hclogArgsToFields("wrapped_extras", []any{"key1", "val1", "orphan"})
		require.Len(t, fields, 2)
		assert.Equal(t, "key1", fields[0].Key)
		assert.Equal(t, "wrapped_extras", fields[1].Key)
	})

	t.Run("single orphan arg stored under extrasKey", func(t *testing.T) {
		fields := hclogArgsToFields("wrapped_extras", []any{"only"})
		require.Len(t, fields, 1)
		assert.Equal(t, "wrapped_extras", fields[0].Key)
	})

	t.Run("non-string key is converted to string", func(t *testing.T) {
		fields := hclogArgsToFields("extras", []any{42, "val"})
		require.Len(t, fields, 1)
		assert.Equal(t, "42", fields[0].Key)
	})
}

func TestHclogAdapterUsesStructuredFields(t *testing.T) {
	logger, err := mlog.NewLogger()
	require.NoError(t, err)
	defer logger.Shutdown()

	adapter := &hclogAdapter{
		wrappedLogger: logger,
		extrasKey:     "wrapped_extras",
	}

	// These should not panic and should produce structured fields rather than
	// a single "wrapped_extras" string.
	assert.NotPanics(t, func() {
		adapter.Info("test message", "user_id", "abc", "count", 42)
		adapter.Debug("debug msg", "key", "value")
		adapter.Warn("warn msg", "error_code", 500)
		adapter.Error("error msg", "err", "something failed")
		adapter.Trace("trace msg")
	})
}
