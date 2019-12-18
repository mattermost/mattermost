// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"net/http"
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

func TestIsValidModels(t *testing.T) {
	i := &IncomingWebhook{}

	require.False(t, i.IsValidModels())
	i.HmacAlgorithm = "HMAC-MD5"
	require.False(t, i.IsValidModels())

	i.HmacAlgorithm = "HMAC-SHA256"
	i.SignedContentModel = StringArray{"we"}
	i.HmacModel = StringInterface{}
	i.HmacModel["HeaderName"] = "good"
	require.True(t, i.IsValidModels())

	// i.TimestampModel = StringInterface{}
	i.HmacModel["HeaderName"] = 1
	require.False(t, i.IsValidModels())
	i.HmacModel["HeaderName"] = "slkjjjjjjjjjjjjjjjjjjjjjjj"
	require.False(t, i.IsValidModels())
	i.HmacModel["HeaderName"] = ""
	require.False(t, i.IsValidModels())

	i.HmacModel["HeaderName"] = "good"
	i.HmacModel["Prefix"] = "1"
	require.True(t, i.IsValidModels())
	i.HmacModel["Prefix"] = 1
	require.False(t, i.IsValidModels())
	i.HmacModel["Prefix"] = "1"
	i.HmacModel["Index"] = "1"
	require.True(t, i.IsValidModels())
	require.Equal(t, StringInterface{"HeaderName": "good", "Prefix": "1"}, i.HmacModel, "Should have only the header name")

	i.TimestampModel["SplitBy"] = "by"
	require.True(t, i.IsValidModels())
	require.Equal(t, StringInterface{}, i.TimestampModel, "Should have reset if no headername for timestamp model")
	i.TimestampModel["HeaderName"] = 1
	require.False(t, i.IsValidModels())
	i.TimestampModel["HeaderName"] = ""
	require.False(t, i.IsValidModels())
	i.TimestampModel["HeaderName"] = "t"
	i.TimestampModel["SplitBy"] = "by"
	i.TimestampModel["Index"] = "3"
	require.True(t, i.IsValidModels())
	delete(i.TimestampModel, "SplitBy")
	require.True(t, i.IsValidModels())
	require.Equal(t, StringInterface{"HeaderName": "t"}, i.TimestampModel, "should match")
	i.TimestampModel["Prefix"] = 1
	require.False(t, i.IsValidModels())
	i.TimestampModel["Prefix"] = "11"
	require.True(t, i.IsValidModels())
	i.TimestampModel["Prefix"] = "123456789"
	require.False(t, i.IsValidModels())

	i.TimestampModel = StringInterface{"HeaderName": "goodName", "SplitBy": "by", "Index": "2", "Prefix": "pre"}
	i.HmacModel = StringInterface{"HeaderName": "goodName", "SplitBy": "by", "Index": "2", "Prefix": "pre"}
	require.True(t, i.IsValidModels())

	i.SignedContentModel = StringArray{}
	require.False(t, i.IsValidModels())
}

func TestParseHeader(t *testing.T) {
	json := []byte(`{"firstName":"John","lastName":"Dow"}`)
	body := bytes.NewBuffer(json)
	req, _ := http.NewRequest("POST", "/ideal", body)

	i := &IncomingWebhook{}
	unsignedHook := SignedIncomingHook{}

	require.Nil(t, i.ParseHeader(&unsignedHook, req), "This should be nil")
	i.HmacModel = StringInterface{"HeaderName": "Signature"}
	require.Error(t, i.ParseHeader(&unsignedHook, req), "This should be an error")
	req.Header.Set("Signature", "djfhgughgjfjgkgjfjgjfkgjfk")
	require.Nil(t, i.ParseHeader(&unsignedHook, req), "This should be nil")

	i.HmacModel["SplitBy"] = "by"
	i.HmacModel["Index"] = "1"
	require.Error(t, i.ParseHeader(&unsignedHook, req), "This should be an error")

	i.HmacModel["Index"] = "0"
	require.Nil(t, i.ParseHeader(&unsignedHook, req), "This should be nil")
	require.Equal(t, SignedIncomingHook{Signature: "djfhgughgjfjgkgjfjgjfkgjfk"}, unsignedHook)

	i.HmacModel["Prefix"] = "v0="
	req.Header.Set("Signature", "v0=djfhgughgjfjgkgjfjgjfkgjfk")
	require.Nil(t, i.ParseHeader(&unsignedHook, req), "This should be nil")
	require.Equal(t, SignedIncomingHook{Signature: "djfhgughgjfjgkgjfjgjfkgjfk"}, unsignedHook)

	i.TimestampModel = StringInterface{"HeaderName": "Timestamp"}
	require.Error(t, i.ParseHeader(&unsignedHook, req), "This should be an error")
	req.Header.Set("Timestamp", "t=123456,j=junc")
	require.Nil(t, i.ParseHeader(&unsignedHook, req), "This should be nil")
	i.TimestampModel["SplitBy"] = ","
	require.Error(t, i.ParseHeader(&unsignedHook, req), "This should be an error")
	i.TimestampModel["Index"] = "0"
	require.Nil(t, i.ParseHeader(&unsignedHook, req), "This should be nil")
	i.TimestampModel["Prefix"] = "t="
	require.Nil(t, i.ParseHeader(&unsignedHook, req), "This should be nil")
	require.Equal(t, SignedIncomingHook{Signature: "djfhgughgjfjgkgjfjgjfkgjfk", Timestamp: "123456"}, unsignedHook)

	bodyP := []byte("me")
	unsignedHook.Payload = &bodyP
	i.SignedContentModel = StringArray{"{timestamp}", "{payload}"}
	require.Nil(t, i.ParseHeader(&unsignedHook, req), "This should be nil")
	require.Equal(t, []byte("123456me"), *unsignedHook.ContentToSign)
}

func TestVerifySignature(t *testing.T) {
	signContent := []byte("me")
	signedHook := SignedIncomingHook{Signature: "292dd895f1318e301d9cb8b088879e357e4a1bb9",
		Algorithm: "HMAC-SHA1", ContentToSign: &signContent}
	require.True(t, signedHook.VerifySignature("secret"), "This should be true")

	signContent = []byte(`{"text": "bullfood"}`)
	signedHook = SignedIncomingHook{Signature: "36ec87e44ad5039a7d488b58a6719964efa36270",
		Algorithm: "HMAC-SHA1", ContentToSign: &signContent}
	require.True(t, signedHook.VerifySignature("secret"), "This should be true")

}

func TestCreateContentToSign(t *testing.T) {
	contentModel := StringArray{"{payload}", "{timestamp}"}
	me := []byte("me")
	signedHook := SignedIncomingHook{Payload: &me, Timestamp: "123"}
	contentModel.CreateContentToSign(&signedHook)
	require.Equal(t, []byte("me123"), *signedHook.ContentToSign)

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

	o.WhiteIpList = StringArray{"", "", "", "", "", ""}
	require.Error(t, o.IsValid())

	o.WhiteIpList = StringArray{"", "", "", "", ""}
	require.Nil(t, o.IsValid())
}

func TestParseHeaderModel(t *testing.T) {
	rawModel := StringInterface{}
	require.Equal(t, HeaderModel{}, ParseHeaderModel(rawModel))
	rawModel = StringInterface{"HeaderName": "me", "bomber": "boom"}
	require.Equal(t, HeaderModel{HeaderName: "me", SplitBy: "", Index: "", Prefix: ""}, ParseHeaderModel(rawModel))
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
