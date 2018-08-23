// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestIncomingWebhookJson(t *testing.T) {
	o := IncomingWebhook{Id: NewId()}
	json := o.ToJson()
	ro := IncomingWebhookFromJson(strings.NewReader(json))

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestIncomingWebhookIsValid(t *testing.T) {
	o := IncomingWebhook{}

	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Id = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CreateAt = GetMillis()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.UpdateAt = GetMillis()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.UserId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.UserId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ChannelId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ChannelId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.TeamId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.TeamId = NewId()
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.DisplayName = strings.Repeat("1", 65)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.DisplayName = strings.Repeat("1", 64)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Description = strings.Repeat("1", 501)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Description = strings.Repeat("1", 500)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Username = strings.Repeat("1", 65)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Username = strings.Repeat("1", 64)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.IconURL = strings.Repeat("1", 1025)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.IconURL = strings.Repeat("1", 1024)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
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
		if iwr == nil {
			t.Fatal("IncomingWebhookRequest should not be nil")
		}
		if iwr.Text != expected {
			t.Fatalf("Sample %d text should be: %s, got: %s", i, expected, iwr.Text)
		}

		attachment := iwr.Attachments[0]
		if attachment.Text != expected {
			t.Fatalf("Sample %d attachment text should be: %s, got: %s", i, expected, attachment.Text)
		}
	}
}

func TestIncomingWebhookNullArrayItems(t *testing.T) {
	payload := `{"attachments":[{"fields":[{"title":"foo","value":"bar","short":true}, null]}, null]}`
	iwr, _ := IncomingWebhookRequestFromJson(strings.NewReader(payload))
	if iwr == nil {
		t.Fatal("IncomingWebhookRequest should not be nil")
	}
	if len(iwr.Attachments) != 1 {
		t.Fatalf("expected one attachment")
	}
	if len(iwr.Attachments[0].Fields) != 1 {
		t.Fatalf("expected one field")
	}
}
