// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseJSONLogRecord(t *testing.T) {
	t.Run("plain JSON with msg and string field", func(t *testing.T) {
		input := `{"level":"info","msg":"user logged in","user_id":"abc123","ts":"2026-01-01T00:00:00Z"}`
		fields, msg, level, ok := parseJSONLogRecord([]byte(input))
		require.True(t, ok)
		assert.Equal(t, "user logged in", msg)
		assert.Equal(t, "info", level)
		// Only user_id should survive; level, msg, ts are skipped
		require.Len(t, fields, 1)
		assert.Equal(t, "user_id", fields[0].Key)
		assert.Equal(t, "abc123", fields[0].String)
	})

	t.Run("message field alias", func(t *testing.T) {
		input := `{"message":"hello world","level":"warn"}`
		_, msg, level, ok := parseJSONLogRecord([]byte(input))
		require.True(t, ok)
		assert.Equal(t, "hello world", msg)
		assert.Equal(t, "warn", level)
	})

	t.Run("integer field preserved as int", func(t *testing.T) {
		input := `{"msg":"req done","status_code":404}`
		fields, _, _, ok := parseJSONLogRecord([]byte(input))
		require.True(t, ok)
		require.Len(t, fields, 1)
		assert.Equal(t, "status_code", fields[0].Key)
		assert.EqualValues(t, 404, fields[0].Integer)
	})

	t.Run("boolean field preserved as bool", func(t *testing.T) {
		input := `{"msg":"check","authenticated":true}`
		fields, _, _, ok := parseJSONLogRecord([]byte(input))
		require.True(t, ok)
		require.Len(t, fields, 1)
		assert.Equal(t, "authenticated", fields[0].Key)
	})

	t.Run("nested object field stored as raw JSON string", func(t *testing.T) {
		input := `{"msg":"request","metadata":{"region":"us-east"}}`
		fields, _, _, ok := parseJSONLogRecord([]byte(input))
		require.True(t, ok)
		require.Len(t, fields, 1)
		assert.Equal(t, "metadata", fields[0].Key)
		assert.Equal(t, `{"region":"us-east"}`, fields[0].String)
	})

	t.Run("non-JSON input returns false", func(t *testing.T) {
		_, _, _, ok := parseJSONLogRecord([]byte("not json at all"))
		assert.False(t, ok)
	})

	t.Run("empty msg falls back to empty string", func(t *testing.T) {
		input := `{"level":"error","user_id":"x"}`
		fields, msg, level, ok := parseJSONLogRecord([]byte(input))
		require.True(t, ok)
		assert.Equal(t, "", msg)
		assert.Equal(t, "error", level)
		require.Len(t, fields, 1)
		assert.Equal(t, "user_id", fields[0].Key)
	})

	t.Run("all standard metadata keys are skipped", func(t *testing.T) {
		input := `{"msg":"x","level":"info","lvl":"info","severity":"info","ts":"t","time":"t","timestamp":"t","t":"t","caller":"c","file":"f","line":"l","custom":"kept"}`
		fields, _, _, ok := parseJSONLogRecord([]byte(input))
		require.True(t, ok)
		require.Len(t, fields, 1)
		assert.Equal(t, "custom", fields[0].Key)
	})

	t.Run("zerolog-style record", func(t *testing.T) {
		input := `{"level":"debug","time":"2026-01-01T00:00:00Z","message":"plugin started","plugin_version":"1.2.3"}`
		fields, msg, level, ok := parseJSONLogRecord([]byte(input))
		require.True(t, ok)
		assert.Equal(t, "plugin started", msg)
		assert.Equal(t, "debug", level)
		require.Len(t, fields, 1)
		assert.Equal(t, "plugin_version", fields[0].Key)
		assert.Equal(t, "1.2.3", fields[0].String)
	})
}

func TestLogWriterJSONExplosion(t *testing.T) {
	logger, err := NewLogger()
	require.NoError(t, err)
	err = logger.ConfigureTargets(map[string]TargetCfg{
		"test": {
			Type:          "file",
			Format:        "json",
			FormatOptions: json.RawMessage(`{}`),
			Levels:        []Level{LvlError, LvlWarn, LvlInfo, LvlDebug},
			Options:       json.RawMessage(`{"filename":"/dev/stderr"}`),
		},
	}, nil)
	require.NoError(t, err)
	defer func() { _ = logger.Shutdown() }()

	writer := logger.StdLogWriter()

	t.Run("plain text passes through as msg", func(t *testing.T) {
		n, err := writer.Write([]byte("hello world"))
		assert.NoError(t, err)
		assert.Equal(t, 11, n)
	})

	t.Run("JSON is accepted without error", func(t *testing.T) {
		payload := `{"level":"info","msg":"user created","user_id":"abc"}`
		n, err := writer.Write([]byte(payload))
		assert.NoError(t, err)
		assert.Equal(t, len(payload), n)
	})

	t.Run("invalid JSON falls back to plain text without error", func(t *testing.T) {
		payload := `{not valid json`
		n, err := writer.Write([]byte(payload))
		assert.NoError(t, err)
		assert.Equal(t, len(payload), n)
	})

	t.Run("whitespace-padded JSON is accepted", func(t *testing.T) {
		payload := "  \n{\"msg\":\"padded\",\"level\":\"warn\"}  \n"
		n, err := writer.Write([]byte(payload))
		assert.NoError(t, err)
		assert.Equal(t, len(payload), n)
	})
}

func TestJSONRawToField(t *testing.T) {
	t.Run("string value", func(t *testing.T) {
		f := jsonRawToField("k", json.RawMessage(`"hello"`))
		assert.Equal(t, "k", f.Key)
		assert.Equal(t, "hello", f.String)
	})

	t.Run("integer value", func(t *testing.T) {
		f := jsonRawToField("k", json.RawMessage(`42`))
		assert.Equal(t, "k", f.Key)
		assert.EqualValues(t, 42, f.Integer)
	})

	t.Run("negative integer value", func(t *testing.T) {
		f := jsonRawToField("k", json.RawMessage(`-7`))
		assert.Equal(t, "k", f.Key)
		assert.EqualValues(t, -7, f.Integer)
	})

	t.Run("float value falls through to float", func(t *testing.T) {
		f := jsonRawToField("k", json.RawMessage(`3.14`))
		assert.Equal(t, "k", f.Key)
	})

	t.Run("boolean true", func(t *testing.T) {
		f := jsonRawToField("k", json.RawMessage(`true`))
		assert.Equal(t, "k", f.Key)
	})

	t.Run("boolean false", func(t *testing.T) {
		f := jsonRawToField("k", json.RawMessage(`false`))
		assert.Equal(t, "k", f.Key)
	})

	t.Run("object stored as raw JSON string", func(t *testing.T) {
		raw := `{"nested":"value"}`
		f := jsonRawToField("k", json.RawMessage(raw))
		assert.Equal(t, "k", f.Key)
		assert.Equal(t, raw, f.String)
	})

	t.Run("null stored as raw JSON string", func(t *testing.T) {
		f := jsonRawToField("k", json.RawMessage(`null`))
		assert.Equal(t, "k", f.Key)
		assert.Equal(t, "null", f.String)
	})

	t.Run("empty raw message returns empty string", func(t *testing.T) {
		f := jsonRawToField("k", json.RawMessage(nil))
		assert.Equal(t, "k", f.Key)
		assert.Equal(t, "", f.String)
	})
}
