// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMarshalMmFieldsBlock(t *testing.T) {
	t.Parallel()

	t.Run("empty input returns nil", func(t *testing.T) {
		raw, err := MarshalMmFieldsBlock(nil)
		require.NoError(t, err)
		assert.Nil(t, raw)

		raw, err = MarshalMmFieldsBlock([]MmField{})
		require.NoError(t, err)
		assert.Nil(t, raw)
	})

	t.Run("skips empty label and value", func(t *testing.T) {
		raw, err := MarshalMmFieldsBlock([]MmField{
			{},
			{Label: "", Value: ""},
			{Label: "Kept", Value: "yes"},
		})
		require.NoError(t, err)
		require.NotNil(t, raw)

		var block map[string]any
		require.NoError(t, json.Unmarshal(raw, &block))
		assert.Equal(t, "fields", block["type"])
		fields, ok := block["fields"].([]any)
		require.True(t, ok)
		require.Len(t, fields, 1)
	})

	t.Run("strips invalid tone and keeps valid tones", func(t *testing.T) {
		raw, err := MarshalMmFieldsBlock([]MmField{
			{Label: "A", Value: "1", Tone: "not-a-tone"},
			{Label: "B", Value: "2", Tone: MmFieldToneDanger},
			{Label: "C", Value: "3", Tone: MmFieldToneCritical},
		})
		require.NoError(t, err)

		var block struct {
			Fields []MmField `json:"fields"`
		}
		require.NoError(t, json.Unmarshal(raw, &block))
		require.Len(t, block.Fields, 3)
		assert.Empty(t, block.Fields[0].Tone)
		assert.Equal(t, MmFieldToneDanger, block.Fields[1].Tone)
		assert.Equal(t, MmFieldToneCritical, block.Fields[2].Tone)
	})

	t.Run("normalizes URL via entityCardURL", func(t *testing.T) {
		raw, err := MarshalMmFieldsBlock([]MmField{
			{Label: "HTTPS", Value: "ok", URL: "https://example.com/path"},
			{Label: "JS", Value: "bad", URL: "javascript:alert(1)"},
			{Label: "Spaces", Value: "bad", URL: "https://example.com/has space"},
		})
		require.NoError(t, err)

		var block struct {
			Fields []MmField `json:"fields"`
		}
		require.NoError(t, json.Unmarshal(raw, &block))
		require.Len(t, block.Fields, 3)
		assert.Equal(t, "https://example.com/path", block.Fields[0].URL)
		assert.Empty(t, block.Fields[1].URL)
		assert.Empty(t, block.Fields[2].URL)
	})
}

func TestMarshalMmBlocks(t *testing.T) {
	t.Parallel()

	t.Run("skips nil empty and null blocks", func(t *testing.T) {
		keep := json.RawMessage(`{"type":"text","text":"hi"}`)
		raw, err := MarshalMmBlocks(nil, json.RawMessage{}, json.RawMessage("null"), keep)
		require.NoError(t, err)
		require.NotNil(t, raw)

		var blocks []json.RawMessage
		require.NoError(t, json.Unmarshal(raw, &blocks))
		require.Len(t, blocks, 1)
		assert.JSONEq(t, string(keep), string(blocks[0]))
	})

	t.Run("returns nil when all empty", func(t *testing.T) {
		raw, err := MarshalMmBlocks(nil, json.RawMessage{}, json.RawMessage("null"))
		require.NoError(t, err)
		assert.Nil(t, raw)
	})
}

func TestMarshalMmTextBlock(t *testing.T) {
	t.Parallel()

	t.Run("empty or whitespace returns nil", func(t *testing.T) {
		for _, text := range []string{"", "   ", "\t\n"} {
			raw, err := MarshalMmTextBlock(text, false)
			require.NoError(t, err)
			assert.Nil(t, raw)
		}
	})

	t.Run("subtle flag sets is_subtle", func(t *testing.T) {
		raw, err := MarshalMmTextBlock("Hello", true)
		require.NoError(t, err)

		var block map[string]any
		require.NoError(t, json.Unmarshal(raw, &block))
		assert.Equal(t, "text", block["type"])
		assert.Equal(t, "Hello", block["text"])
		assert.Equal(t, true, block["is_subtle"])
	})

	t.Run("without subtle omits is_subtle", func(t *testing.T) {
		raw, err := MarshalMmTextBlock("Hello", false)
		require.NoError(t, err)

		var block map[string]any
		require.NoError(t, json.Unmarshal(raw, &block))
		_, ok := block["is_subtle"]
		assert.False(t, ok)
	})
}

func TestMarshalMmCollapsibleBlock(t *testing.T) {
	t.Parallel()

	content, err := MarshalMmTextBlock("Body", false)
	require.NoError(t, err)

	t.Run("empty header returns nil", func(t *testing.T) {
		raw, err := MarshalMmCollapsibleBlock("  ", []json.RawMessage{content}, false)
		require.NoError(t, err)
		assert.Nil(t, raw)
	})

	t.Run("empty content returns nil", func(t *testing.T) {
		raw, err := MarshalMmCollapsibleBlock("Header", nil, false)
		require.NoError(t, err)
		assert.Nil(t, raw)

		raw, err = MarshalMmCollapsibleBlock("Header", []json.RawMessage{nil, json.RawMessage("null")}, false)
		require.NoError(t, err)
		assert.Nil(t, raw)
	})

	t.Run("collapsed flag", func(t *testing.T) {
		raw, err := MarshalMmCollapsibleBlock("Header", []json.RawMessage{content}, true)
		require.NoError(t, err)

		var collapsed map[string]any
		require.NoError(t, json.Unmarshal(raw, &collapsed))
		assert.Equal(t, "collapsible", collapsed["type"])
		assert.Equal(t, true, collapsed["collapsed"])

		raw, err = MarshalMmCollapsibleBlock("Header", []json.RawMessage{content}, false)
		require.NoError(t, err)
		var open map[string]any
		require.NoError(t, json.Unmarshal(raw, &open))
		_, ok := open["collapsed"]
		assert.False(t, ok)
	})
}

func TestMmFieldToneFromQualitative(t *testing.T) {
	t.Parallel()

	tests := []struct {
		in   string
		want string
	}{
		{"none", MmFieldToneDefault},
		{"low", MmFieldToneGood},
		{"medium", MmFieldToneWarning},
		{"partial", MmFieldToneWarning},
		{"high", MmFieldToneDanger},
		{"complete", MmFieldToneDanger},
		{"changed", MmFieldToneDanger},
		{"critical", MmFieldToneCritical},
		{"  HIGH  ", MmFieldToneDanger},
		{"Critical", MmFieldToneCritical},
		{"unknown", ""},
		{"", ""},
	}
	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			assert.Equal(t, tc.want, MmFieldToneFromQualitative(tc.in))
		})
	}
}
