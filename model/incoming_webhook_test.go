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

	o.Description = strings.Repeat("1", 129)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Description = strings.Repeat("1", 128)
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

func TestIncomingWebhookRequestFromJson_Announcements(t *testing.T) {
	text := "This message will send a notification to all team members in the channel where you post the message, because it contains: <!channel>"
	expected := "This message will send a notification to all team members in the channel where you post the message, because it contains: @channel"

	// simple payload
	payload := `{"text": "` + text + `"}`
	data := strings.NewReader(payload)
	iwr := IncomingWebhookRequestFromJson(data)

	if iwr == nil {
		t.Fatal("IncomingWebhookRequest should not be nil")
	}
	if iwr.Text != expected {
		t.Fatalf("Sample text should be: %s, got: %s", expected, iwr.Text)
	}

	// payload with attachment (pretext, title, text, value)
	payload = `{
			"attachments": [
				{
					"pretext": "` + text + `",
					"title": "` + text + `",
					"text": "` + text + `",
					"fields": [
						{
							"title": "A title",
							"value": "` + text + `",
							"short": false
						}
					]
				}
			]
		}`

	data = strings.NewReader(payload)
	iwr = IncomingWebhookRequestFromJson(data)

	if iwr == nil {
		t.Fatal("IncomingWebhookRequest should not be nil")
	}

	attachment := iwr.Attachments[0]
	if attachment.Pretext != expected {
		t.Fatalf("Sample attachment pretext should be:%s, got: %s", expected, attachment.Pretext)
	}
	if attachment.Text != expected {
		t.Fatalf("Sample attachment text should be: %s, got: %s", expected, attachment.Text)
	}
	if attachment.Title != expected {
		t.Fatalf("Sample attachment title should be: %s, got: %s", expected, attachment.Title)
	}

	field := attachment.Fields[0]
	if field.Value != expected {
		t.Fatalf("Sample attachment field value should be: %s, got: %s", expected, field.Value)
	}
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
		iwr := IncomingWebhookRequestFromJson(data)

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
	iwr := IncomingWebhookRequestFromJson(strings.NewReader(payload))
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
