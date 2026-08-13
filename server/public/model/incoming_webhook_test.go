// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

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
