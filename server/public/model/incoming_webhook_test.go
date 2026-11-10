// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIncomingWebhookIsValid(t *testing.T) {
	o := IncomingWebhook{}

	require.NotNil(t, o.IsValid())

	o.Id = NewId()
	require.NotNil(t, o.IsValid())

	o.CreateAt = GetMillis()
	require.NotNil(t, o.IsValid())

	o.UpdateAt = GetMillis()
	require.NotNil(t, o.IsValid())

	o.UserId = "123"
	require.NotNil(t, o.IsValid())

	o.UserId = NewId()
	require.NotNil(t, o.IsValid())

	o.ChannelId = "123"
	require.NotNil(t, o.IsValid())

	o.ChannelId = NewId()
	require.NotNil(t, o.IsValid())

	o.TeamId = "123"
	require.NotNil(t, o.IsValid())

	o.TeamId = NewId()
	require.Nil(t, o.IsValid())

	o.DisplayName = strings.Repeat("1", 65)
	require.NotNil(t, o.IsValid())

	o.DisplayName = strings.Repeat("1", 64)
	require.Nil(t, o.IsValid())

	o.Description = strings.Repeat("1", 501)
	require.NotNil(t, o.IsValid())

	o.Description = strings.Repeat("1", 500)
	require.Nil(t, o.IsValid())

	o.Username = strings.Repeat("1", 65)
	require.NotNil(t, o.IsValid())

	o.Username = strings.Repeat("1", 64)
	require.Nil(t, o.IsValid())

	o.IconURL = strings.Repeat("1", 1025)
	require.NotNil(t, o.IsValid())

	o.IconURL = strings.Repeat("1", 1024)
	require.Nil(t, o.IsValid())
}

func TestIncomingWebhookPreSave(t *testing.T) {
	o := IncomingWebhook{}
	o.PreSave()
}

func TestIncomingWebhookPreUpdate(t *testing.T) {
	o := IncomingWebhook{}
	o.PreUpdate()
}

func TestIncomingWebhookRequestHasInteractiveMessageProps(t *testing.T) {
	t.Run("nil request", func(t *testing.T) {
		var req *IncomingWebhookRequest
		require.False(t, req.HasInteractiveMessageProps(true))
	})

	t.Run("empty props", func(t *testing.T) {
		req := &IncomingWebhookRequest{}
		require.False(t, req.HasInteractiveMessageProps(true))
	})

	t.Run("empty interactive arrays", func(t *testing.T) {
		req := &IncomingWebhookRequest{
			Props: StringInterface{
				PostPropsMmBlocks:       []any{},
				PostPropsBlockKitBlocks: []any{},
				PostPropsAdaptiveCards:  []any{},
				PostPropsAttachments:    []any{},
			},
		}
		require.False(t, req.HasInteractiveMessageProps(true))
	})

	t.Run("mm_blocks when feature flag enabled", func(t *testing.T) {
		req := &IncomingWebhookRequest{
			Props: StringInterface{
				PostPropsMmBlocks: []any{map[string]any{"type": "text", "text": "hello"}},
			},
		}
		require.True(t, req.HasInteractiveMessageProps(true))
	})

	t.Run("mm_blocks ignored when feature flag disabled", func(t *testing.T) {
		req := &IncomingWebhookRequest{
			Props: StringInterface{
				PostPropsMmBlocks: []any{map[string]any{"type": "text", "text": "hello"}},
			},
		}
		require.False(t, req.HasInteractiveMessageProps(false))
	})

	t.Run("blocks when feature flag enabled", func(t *testing.T) {
		req := &IncomingWebhookRequest{
			Props: StringInterface{
				PostPropsBlockKitBlocks: []any{map[string]any{"type": "section"}},
			},
		}
		require.True(t, req.HasInteractiveMessageProps(true))
	})

	t.Run("cards when feature flag enabled", func(t *testing.T) {
		req := &IncomingWebhookRequest{
			Props: StringInterface{
				PostPropsAdaptiveCards: []any{map[string]any{"type": "AdaptiveCard"}},
			},
		}
		require.True(t, req.HasInteractiveMessageProps(true))
	})

	t.Run("attachments in props regardless of feature flag", func(t *testing.T) {
		req := &IncomingWebhookRequest{
			Props: StringInterface{
				PostPropsAttachments: []any{map[string]any{"text": "attachment"}},
			},
		}
		require.True(t, req.HasInteractiveMessageProps(true))
		require.True(t, req.HasInteractiveMessageProps(false))
	})
}

func TestIncomingWebhookRequestFromJSON(t *testing.T) {
	texts := []string{
		`this is a test`,
		`this is a test
			that contains a newline and tabs`,
		`this is a test \"foo
			that contains a newline and tabs`,
		`this is a test \"foo\"
			that contains a newline and tabs`,
		`this is a test \"foo\"
		\"			that contains a newline and tabs`,
		`this is a test \"foo\"

		\"			that contains a newline and tabs
		`,
	}

	for _, text := range texts {
		// build a sample payload with the text
		payload := `{
        "text": "` + text + `",
        "attachments": [
            {
                "fallback": "` + text + `",

                "color": "#36a64f",

                "pretext": "` + text + `",

                "author_name": "` + text + `",
                "author_link": "http://flickr.com/bobby/",
                "author_icon": "http://flickr.com/icons/bobby.jpg",

                "title": "` + text + `",
                "title_link": "https://api.slack.com/",

                "text": "` + text + `",

                "fields": [
                    {
                        "title": "` + text + `",
                        "value": "` + text + `",
                        "short": false
                    }
                ],

                "image_url": "http://my-website.com/path/to/image.jpg",
                "thumb_url": "http://example.com/path/to/thumb.png"
            }
        ]
    }`

		// try to create an IncomingWebhookRequest from the payload
		data := strings.NewReader(payload)
		iwr, _ := IncomingWebhookRequestFromJSON(data)

		// After it has been decoded, the JSON string won't contain the escape char anymore
		expected := strings.Replace(text, `\"`, `"`, -1)
		require.NotNil(t, iwr)
		require.Equal(t, expected, iwr.Text)

		attachment := iwr.Attachments[0]
		require.Equal(t, expected, attachment.Text)
	}
}

func TestIncomingWebhookNullArrayItems(t *testing.T) {
	payload := `{"attachments":[{"fields":[{"title":"foo","value":"bar","short":true}, null]}, null]}`
	iwr, _ := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
	require.NotNil(t, iwr)
	require.Len(t, iwr.Attachments, 1)
	require.Len(t, iwr.Attachments[0].Fields, 1)
}

func TestIncomingWebhookRequestFromJSONRootId(t *testing.T) {
	id := NewId()
	payload := `{"text":"hello","root_id":"` + id + `"}`
	iwr, err := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
	require.Nil(t, err)
	require.NotNil(t, iwr)
	require.Equal(t, id, iwr.RootId)
}

func TestIncomingWebhookRequestFromJSONNullCharacters(t *testing.T) {
	t.Run("removes NULL characters from text, attachments and props", func(t *testing.T) {
		payload := `{
			"text": "te\u0000st",
			"username": "bot\u0000",
			"attachments": [{
				"pretext": "pre\u0000text",
				"text": "attachment\u0000 text",
				"author_name": "\u0000author",
				"fields": [{"title": "ti\u0000tle", "value": "va\u0000lue", "short": true}]
			}],
			"props": {"ke\u0000y": "va\u0000lue", "count": 3, "items": [{"ke\u0000y": "a\u0000b"}]}
		}`

		iwr, err := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
		require.Nil(t, err)
		require.NotNil(t, iwr)

		assert.Equal(t, "test", iwr.Text)
		assert.Equal(t, "bot", iwr.Username)
		require.Len(t, iwr.Attachments, 1)
		attachment := iwr.Attachments[0]
		assert.Equal(t, "pretext", attachment.Pretext)
		assert.Equal(t, "attachment text", attachment.Text)
		assert.Equal(t, "author", attachment.AuthorName)
		require.Len(t, attachment.Fields, 1)
		assert.Equal(t, "title", attachment.Fields[0].Title)
		assert.Equal(t, "value", attachment.Fields[0].Value)
		assert.Equal(t, "value", iwr.Props["key"])
		assert.NotContains(t, iwr.Props, "ke\x00y")
		assert.Equal(t, float64(3), iwr.Props["count"])
		assert.Equal(t, []any{map[string]any{"key": "ab"}}, iwr.Props["items"])
	})

	t.Run("removes NULL characters from payloads that need control characters escaped", func(t *testing.T) {
		payload := "{\"text\": \"line one\nline\\u0000 two\"}"

		iwr, err := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
		require.Nil(t, err)
		require.NotNil(t, iwr)
		assert.Equal(t, "line one\nline two", iwr.Text)
	})

	t.Run("resolves keys that collide after removing NULL characters deterministically", func(t *testing.T) {
		payload := `{"text": "hello", "props": {"a\u0000b": "with null", "ab": "without null", "c\u0000d": "first", "cd\u0000": "second"}}`

		for range 20 {
			iwr, err := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
			require.Nil(t, err)
			require.NotNil(t, iwr)
			assert.Equal(t, "without null", iwr.Props["ab"])
			assert.Equal(t, "first", iwr.Props["cd"])
			assert.Len(t, iwr.Props, 2)
		}
	})

	t.Run("does not change which key is decoded into a field", func(t *testing.T) {
		// encoding/json matches field names case-insensitively and the last match wins.
		// Removing NULL characters must not change that.
		payload := `{"text": "literal \\u0000", "TEXT": "intended"}`

		iwr, err := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
		require.Nil(t, err)
		require.NotNil(t, iwr)
		assert.Equal(t, "intended", iwr.Text)
	})

	t.Run("ignores unknown keys that would match a field once NULL characters are removed", func(t *testing.T) {
		payload := `{"text": "a\u0000b", "sil\u0000ent": "bad"}`

		iwr, err := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
		require.Nil(t, err)
		require.NotNil(t, iwr)
		assert.Equal(t, "ab", iwr.Text)
		assert.False(t, iwr.Silent)
	})

	t.Run("keeps an escaped backslash followed by u0000", func(t *testing.T) {
		payload := `{"text": "literal \\u0000 text"}`

		iwr, err := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
		require.Nil(t, err)
		require.NotNil(t, iwr)
		assert.Equal(t, `literal \u0000 text`, iwr.Text)
	})

	t.Run("keeps HTML characters unescaped", func(t *testing.T) {
		payload := `{"text": "<b>a & b</b>\u0000"}`

		iwr, err := IncomingWebhookRequestFromJSON(strings.NewReader(payload))
		require.Nil(t, err)
		require.NotNil(t, iwr)
		assert.Equal(t, "<b>a & b</b>", iwr.Text)
	})
}
