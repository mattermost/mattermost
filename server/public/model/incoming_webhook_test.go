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

func TestIncomingWebhookRequestFromJSONTolerant(t *testing.T) {
	t.Run("clean body uses the strict path", func(t *testing.T) {
		payload := `{"text":"hello","username":"bot"}`
		iwr, err := IncomingWebhookRequestFromJSONTolerant(strings.NewReader(payload))
		require.Nil(t, err)
		require.Equal(t, "hello", iwr.Text)
		require.Equal(t, "bot", iwr.Username)
	})

	t.Run("type-mismatched priority is dropped, others survive", func(t *testing.T) {
		// "priority" collides with *PostPriority in the typed struct.
		// Strict decode would fail; tolerant decode drops the field and
		// keeps everything else intact.
		payload := `{"text":"hello","priority":"high","username":"bot"}`
		iwr, err := IncomingWebhookRequestFromJSONTolerant(strings.NewReader(payload))
		require.Nil(t, err)
		require.Equal(t, "hello", iwr.Text)
		require.Equal(t, "bot", iwr.Username)
		require.Nil(t, iwr.Priority)
	})

	t.Run("foreign payload with no matching keys yields empty struct", func(t *testing.T) {
		// Grafana-style alert payload — nothing matches IncomingWebhookRequest
		// keys; the typed struct stays zero-valued and the call succeeds.
		payload := `{"alerts":[{"summary":"Disk full"}],"status":"firing"}`
		iwr, err := IncomingWebhookRequestFromJSONTolerant(strings.NewReader(payload))
		require.Nil(t, err)
		require.Equal(t, "", iwr.Text)
		require.Nil(t, iwr.Priority)
		require.Empty(t, iwr.Attachments)
	})

	t.Run("priority as object still parses", func(t *testing.T) {
		// When the body carries the typed priority shape, it should be
		// preserved by the tolerant path (the fast strict path catches it).
		payload := `{"text":"hi","priority":{"priority":"urgent"}}`
		iwr, err := IncomingWebhookRequestFromJSONTolerant(strings.NewReader(payload))
		require.Nil(t, err)
		require.NotNil(t, iwr.Priority)
		require.NotNil(t, iwr.Priority.Priority)
		require.Equal(t, "urgent", *iwr.Priority.Priority)
	})

	t.Run("invalid JSON still errors", func(t *testing.T) {
		payload := `not json`
		_, err := IncomingWebhookRequestFromJSONTolerant(strings.NewReader(payload))
		require.NotNil(t, err)
	})

	t.Run("attachment type mismatch drops only that field", func(t *testing.T) {
		// "attachments" as a string instead of an array — the typed field
		// stays nil but the rest of the payload is preserved.
		payload := `{"text":"hi","attachments":"oops","username":"bot"}`
		iwr, err := IncomingWebhookRequestFromJSONTolerant(strings.NewReader(payload))
		require.Nil(t, err)
		require.Equal(t, "hi", iwr.Text)
		require.Equal(t, "bot", iwr.Username)
		require.Empty(t, iwr.Attachments)
	})

	t.Run("control char escape fallback still works", func(t *testing.T) {
		// Force the body to fail strict parse only via a control char in
		// a string. The strict variant succeeds via the escape fallback;
		// the tolerant path must too.
		payload := "{\"text\":\"hi\nthere\"}"
		iwr, err := IncomingWebhookRequestFromJSONTolerant(strings.NewReader(payload))
		require.Nil(t, err)
		require.Contains(t, iwr.Text, "hi")
	})
}
