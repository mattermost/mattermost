// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// assertLogField asserts that fields contains a field with the given key and value.
// For string fields pass a string value; for integer fields pass an int or int64.
func assertLogField(t *testing.T, fields []mlog.Field, key string, want any) {
	t.Helper()
	for _, f := range fields {
		if f.Key != key {
			continue
		}
		switch w := want.(type) {
		case string:
			assert.Equal(t, w, f.String, "field %q: wrong string value", key)
		case int:
			assert.Equal(t, int64(w), f.Integer, "field %q: wrong integer value", key)
		case int64:
			assert.Equal(t, w, f.Integer, "field %q: wrong integer value", key)
		default:
			t.Errorf("field %q: unsupported want type %T", key, want)
		}
		return
	}
	t.Errorf("field %q not found in log fields: %s", key, formatLogFields(fields))
}

// assertNoLogField asserts that fields does not contain a field with the given key.
func assertNoLogField(t *testing.T, fields []mlog.Field, key string) {
	t.Helper()
	for _, f := range fields {
		if f.Key == key {
			t.Errorf("field %q unexpectedly present with value %q / %d", key, f.String, f.Integer)
			return
		}
	}
}

func formatLogFields(fields []mlog.Field) string {
	keys := make([]string, len(fields))
	for i, f := range fields {
		if f.String != "" {
			keys[i] = fmt.Sprintf("%s=%q", f.Key, f.String)
		} else {
			keys[i] = fmt.Sprintf("%s=%d", f.Key, f.Integer)
		}
	}
	return fmt.Sprintf("%v", keys)
}

func TestClusterMessageLogFields(t *testing.T) {
	t.Run("always includes base fields", func(t *testing.T) {
		data := []byte(`{"user_id":"abc"}`)
		fields := (&ClusterMessage{
			Event:    ClusterEventUpdateStatus,
			SendType: ClusterSendReliable,
			Data:     data,
		}).LogFields()

		assertLogField(t, fields, "event", string(ClusterEventUpdateStatus))
		assertLogField(t, fields, "send_type", ClusterSendReliable)
		assertLogField(t, fields, "data_len", int64(len(data)))
	})

	t.Run("publish extracts ws_event channel_id team_id and omit_users_len", func(t *testing.T) {
		data, err := json.Marshal(map[string]any{
			"event": "status_change",
			"broadcast": map[string]any{
				"channel_id": "ch1",
				"team_id":    "tm1",
				"omit_users": map[string]bool{"u1": true, "u2": true, "u3": true},
			},
		})
		require.NoError(t, err)

		fields := (&ClusterMessage{
			Event:    ClusterEventPublish,
			SendType: ClusterSendBestEffort,
			Data:     data,
		}).LogFields()

		assertLogField(t, fields, "ws_event", "status_change")
		assertLogField(t, fields, "channel_id", "ch1")
		assertLogField(t, fields, "team_id", "tm1")
		assertLogField(t, fields, "omit_users_len", int64(3))
	})

	t.Run("publish omits channel_id and team_id when empty", func(t *testing.T) {
		data, err := json.Marshal(map[string]any{
			"event":     "typing",
			"broadcast": map[string]any{},
		})
		require.NoError(t, err)

		fields := (&ClusterMessage{
			Event: ClusterEventPublish,
			Data:  data,
		}).LogFields()

		assertNoLogField(t, fields, "channel_id")
		assertNoLogField(t, fields, "team_id")
	})

	t.Run("publish omits omit_users_len when zero", func(t *testing.T) {
		data, err := json.Marshal(map[string]any{
			"event":     "typing",
			"broadcast": map[string]any{"channel_id": "ch1"},
		})
		require.NoError(t, err)

		fields := (&ClusterMessage{
			Event: ClusterEventPublish,
			Data:  data,
		}).LogFields()

		assertNoLogField(t, fields, "omit_users_len")
	})

	t.Run("publish with invalid data returns only base fields", func(t *testing.T) {
		fields := (&ClusterMessage{
			Event:    ClusterEventPublish,
			SendType: ClusterSendBestEffort,
			Data:     []byte("not valid json"),
		}).LogFields()

		assert.Len(t, fields, 3)
		assertNoLogField(t, fields, "ws_event")
	})

	t.Run("plugin event extracts plugin_id and event_id", func(t *testing.T) {
		fields := (&ClusterMessage{
			Event:    ClusterEventPluginEvent,
			SendType: ClusterSendReliable,
			Props: map[string]string{
				"PluginID": "com.example.plugin",
				"EventID":  "my-event",
			},
		}).LogFields()

		assertLogField(t, fields, "plugin_id", "com.example.plugin")
		assertLogField(t, fields, "event_id", "my-event")
	})

	t.Run("plugin event with no props omits plugin fields", func(t *testing.T) {
		fields := (&ClusterMessage{
			Event:    ClusterEventPluginEvent,
			SendType: ClusterSendReliable,
		}).LogFields()

		assertNoLogField(t, fields, "plugin_id")
		assertNoLogField(t, fields, "event_id")
	})

	t.Run("unrelated event type returns only base fields", func(t *testing.T) {
		fields := (&ClusterMessage{
			Event:    ClusterEventInvalidateCacheForChannel,
			SendType: ClusterSendReliable,
			Data:     []byte(`"channel-id"`),
		}).LogFields()

		assert.Len(t, fields, 3)
	})
}
