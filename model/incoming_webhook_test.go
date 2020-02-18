// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

	require.Equal(t, o.Id, ro.Id)
}

func TestValidHeaderModel(t *testing.T) {
	p := StringInterface{"HeaderName": "dsdfa", "SplitBy": "", "Index": 1}

	o1, o2 := p.ValidHeaderModel("HeaderName")
	require.Equal(t, "dsdfa", o1, "Should be equal")
	require.True(t, o2, "Should be equal")

	o1, o2 = p.ValidHeaderModel("SplitBy")
	require.Equal(t, "", o1, "Should be equal")
	require.True(t, o2, "Should be equal")

	o1, o2 = p.ValidHeaderModel("Index")
	require.Equal(t, "", o1, "Should be equal")
	require.True(t, o2, "Should be equal")

	o1, o2 = p.ValidHeaderModel("KeyNotThere")
	require.Equal(t, "", o1, "Should be equal")
	require.False(t, o2, "Should be equal")

	p["Prefix"] = 0
	o1, o2 = p.ValidHeaderModel("Prefix")
	require.Equal(t, "", o1, "Should be equal")
	require.True(t, o2, "Should be equal")
}

func TestValidModelSplitter(t *testing.T) {
	var p StringInterface = map[string]interface{}{"HeaderName": "dsdfa", "SplitBy": "some", "Index": 1}

	require.False(t, ValidModelSplitter(&p))
	p["Index"] = "1"
	require.True(t, ValidModelSplitter(&p))

	p["Index"] = "str"
	require.False(t, ValidModelSplitter(&p))
	p["Index"] = "-1"
	require.False(t, ValidModelSplitter(&p))
	p["Index"] = "6"
	require.False(t, ValidModelSplitter(&p))
	p["Index"] = "0"
	require.True(t, ValidModelSplitter(&p))
	delete(p, "Index")
	require.False(t, ValidModelSplitter(&p))
	p["SplitBy"] = ""
	p["Index"] = "0"
	require.False(t, ValidModelSplitter(&p))

	delete(p, "SplitBy")
	require.True(t, ValidModelSplitter(&p))
	require.Equal(t, StringInterface{"HeaderName": "dsdfa"}, p, "should be reset to StringInterface{} with header name preserved")
}

func TestIsValidSignatureModels(t *testing.T) {
	i := &IncomingWebhook{}
	// empty signature model, default to hmac algorithm error
	require.Equal(t, "model.incoming_hook.hmac_algorithm.app_error", i.IsValidSignatureModels().Id)
	// invalid hmac algorithm
	i.HmacAlgorithm = "HMAC-MD5"
	require.Equal(t, "model.incoming_hook.hmac_algorithm.app_error", i.IsValidSignatureModels().Id)

	i.HmacAlgorithm = "HMAC-SHA256"
	i.SignedContentModel = StringArray{}
	require.Equal(t, "model.incoming_hook.signed_content_model.app_error", i.IsValidSignatureModels().Id)

	i.SignedContentModel = StringArray{"we"}
	i.HmacModel = StringInterface{}
	require.Equal(t, "model.incoming_hook.hmac_headername.app_error", i.IsValidSignatureModels().Id)

	i.HmacModel["HeaderName"] = "good"
	i.HmacModel["SplitBy"] = ","
	require.Equal(t, "model.incoming_hook.hmac_splitter.app_error", i.IsValidSignatureModels().Id)
	i.HmacModel["SplitBy"] = ""
	require.Nil(t, i.IsValidSignatureModels())

	i.HmacModel["Prefix"] = ""
	require.Equal(t, "model.incoming_hook.hmac_prefix.app_error", i.IsValidSignatureModels().Id)

	i.HmacModel["Prefix"] = "1"
	i.TimestampModel["HeaderName"] = 1
	require.Equal(t, "model.incoming_hook.timestamp_header.app_error", i.IsValidSignatureModels().Id)
	i.TimestampModel = StringInterface{"HeaderName": "goodName"}
	require.Nil(t, i.IsValidSignatureModels())

	i.TimestampModel["SplitBy"] = "by"
	require.Equal(t, "model.incoming_hook.timestamp_splitter.app_error", i.IsValidSignatureModels().Id)

	i.TimestampModel["Index"] = "3"
	i.TimestampModel["Prefix"] = ""
	require.Equal(t, "model.incoming_hook.timestamp_prefix.app_error", i.IsValidSignatureModels().Id)
	i.TimestampModel["Prefix"] = "t1="
	require.Nil(t, i.IsValidSignatureModels())
}

func TestIncomingWebhookIsValid(t *testing.T) {
	o := IncomingWebhook{}

	require.Error(t, o.IsValid())

	o.Id = NewId()
	require.Error(t, o.IsValid())

	o.CreateAt = GetMillis()
	require.Error(t, o.IsValid())

	o.UpdateAt = GetMillis()
	require.Error(t, o.IsValid())

	o.UserId = "123"
	require.Error(t, o.IsValid())

	o.UserId = NewId()
	require.Error(t, o.IsValid())

	o.ChannelId = "123"
	require.Error(t, o.IsValid())

	o.ChannelId = NewId()
	require.Error(t, o.IsValid())

	o.TeamId = "123"
	require.Error(t, o.IsValid())

	o.TeamId = NewId()
	o.SecretToken = ""
	require.Nil(t, o.IsValid())

	o.DisplayName = strings.Repeat("1", 65)
	require.Error(t, o.IsValid())

	o.DisplayName = strings.Repeat("1", 64)
	require.Nil(t, o.IsValid())

	o.Description = strings.Repeat("1", 501)
	require.Error(t, o.IsValid())

	o.Description = strings.Repeat("1", 500)
	require.Nil(t, o.IsValid())

	o.Username = strings.Repeat("1", 65)
	require.Error(t, o.IsValid())

	o.Username = strings.Repeat("1", 64)
	require.Nil(t, o.IsValid())

	o.IconURL = strings.Repeat("1", 1025)
	require.Error(t, o.IsValid())

	o.IconURL = strings.Repeat("1", 1024)
	require.Nil(t, o.IsValid())

	for _, tokenLength := range [3]int{1, 25, 27} {
		o.SecretToken = NewRandomString(tokenLength)
		require.Error(t, o.IsValid())
	}

	for _, token := range [2]string{"", NewRandomString(26)} {
		o.SecretToken = token
		require.Nil(t, o.IsValid())
	}
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
		iwr, _ := IncomingWebhookRequestFromJson(data)

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
	iwr, _ := IncomingWebhookRequestFromJson(strings.NewReader(payload))
	require.NotNil(t, iwr)
	require.Len(t, iwr.Attachments, 1)
	require.Len(t, iwr.Attachments[0].Fields, 1)
}
