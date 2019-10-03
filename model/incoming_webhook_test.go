// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIncomingWebhookJson(t *testing.T) {
	o := IncomingWebhook{Id: NewId()}
	json := o.ToJson()
	ro := IncomingWebhookFromJson(strings.NewReader(json))

	require.Equal(t, o.Id, ro.Id, "Ids do not match")
}

func TestIncomingWebhookIsValid(t *testing.T) {
	o := IncomingWebhook{}

	require.Error(t, o.IsValid(), "should be invalid")

	o.Id = NewId()
	require.Error(t, o.IsValid(), "should be invalid")

	o.CreateAt = GetMillis()
	require.Error(t, o.IsValid(), "should be invalid")

	o.UpdateAt = GetMillis()
	require.Error(t, o.IsValid(), "should be invalid")

	o.UserId = "123"
	require.Error(t, o.IsValid(), "should be invalid")

	o.UserId = NewId()
	require.Error(t, o.IsValid(), "should be invalid")

	o.ChannelId = "123"
	require.Error(t, o.IsValid(), "should be invalid")

	o.ChannelId = NewId()
	require.Error(t, o.IsValid(), "should be invalid")

	o.TeamId = "123"
	require.Error(t, o.IsValid(), "should be invalid")

	o.TeamId = NewId()
	require.Equal(t, (*AppError)(nil), o.IsValid())

	o.DisplayName = strings.Repeat("1", 65)
	require.Error(t, o.IsValid(), "should be invalid")

	o.DisplayName = strings.Repeat("1", 64)
	require.Equal(t, (*AppError)(nil), o.IsValid())

	o.Description = strings.Repeat("1", 501)
	require.Error(t, o.IsValid(), "should be invalid")

	o.Description = strings.Repeat("1", 500)
	require.Equal(t, (*AppError)(nil), o.IsValid())

	o.Username = strings.Repeat("1", 65)
	require.Error(t, o.IsValid(), "should be invalid")

	o.Username = strings.Repeat("1", 64)
	require.Equal(t, (*AppError)(nil), o.IsValid())

	o.IconURL = strings.Repeat("1", 1025)
	require.Error(t, o.IsValid(), "should be invalid")

	o.IconURL = strings.Repeat("1", 1024)
	require.Equal(t, (*AppError)(nil), o.IsValid())
}

func TestIncomingWebhookPreSave(t *testing.T) {
	o := IncomingWebhook{}
	o.PreSave()
}

func TestIncomingWebhookPreUpdate(t *testing.T) {
	o := IncomingWebhook{}
	o.PreUpdate()
}

func TestIncomingWebhookRequestFromJson(t *testing.T) {
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

	for i, text := range texts {
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
		iwr, _ := IncomingWebhookRequestFromJson(data)

		// After it has been decoded, the JSON string won't contain the escape char anymore
		expected := strings.Replace(text, `\"`, `"`, -1)
		require.NotNil(t, iwr, "IncomingWebhookRequest should not be nil")
		require.Equalf(t, expected, iwr.Text, "Sample %d text should be: %s, got: %s", i, expected, iwr.Text)

		attachment := iwr.Attachments[0]
		require.Equalf(t, expected, attachment.Text, "Sample %d attachment text should be: %s, got: %s", i, expected, attachment.Text)
	}
}

func TestIncomingWebhookNullArrayItems(t *testing.T) {
	payload := `{"attachments":[{"fields":[{"title":"foo","value":"bar","short":true}, null]}, null]}`
	iwr, _ := IncomingWebhookRequestFromJson(strings.NewReader(payload))
	require.NotNil(t, iwr,"IncomingWebhookRequest should not be nil" )
	require.Len(t, iwr.Attachments, 1, "expected one attachment")
	require.Len(t, iwr.Attachments[0].Fields, 1, "expected one field")
}
