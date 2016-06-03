// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"io"
	"regexp"
	"strings"
)

const (
	DEFAULT_WEBHOOK_USERNAME = "webhook"
)

type IncomingWebhook struct {
	Id          string `json:"id"`
	CreateAt    int64  `json:"create_at"`
	UpdateAt    int64  `json:"update_at"`
	DeleteAt    int64  `json:"delete_at"`
	UserId      string `json:"user_id"`
	ChannelId   string `json:"channel_id"`
	TeamId      string `json:"team_id"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
}

type IncomingWebhookRequest struct {
	Text        string          `json:"text"`
	Username    string          `json:"username"`
	IconURL     string          `json:"icon_url"`
	ChannelName string          `json:"channel"`
	Props       StringInterface `json:"props"`
	Attachments interface{}     `json:"attachments"`
	Type        string          `json:"type"`
}

func (o *IncomingWebhook) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func IncomingWebhookFromJson(data io.Reader) *IncomingWebhook {
	decoder := json.NewDecoder(data)
	var o IncomingWebhook
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func IncomingWebhookListToJson(l []*IncomingWebhook) string {
	b, err := json.Marshal(l)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func IncomingWebhookListFromJson(data io.Reader) []*IncomingWebhook {
	decoder := json.NewDecoder(data)
	var o []*IncomingWebhook
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}

func (o *IncomingWebhook) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewLocAppError("IncomingWebhook.IsValid", "model.incoming_hook.id.app_error", nil, "")
	}

	if o.CreateAt == 0 {
		return NewLocAppError("IncomingWebhook.IsValid", "model.incoming_hook.create_at.app_error", nil, "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewLocAppError("IncomingWebhook.IsValid", "model.incoming_hook.update_at.app_error", nil, "id="+o.Id)
	}

	if len(o.UserId) != 26 {
		return NewLocAppError("IncomingWebhook.IsValid", "model.incoming_hook.user_id.app_error", nil, "")
	}

	if len(o.ChannelId) != 26 {
		return NewLocAppError("IncomingWebhook.IsValid", "model.incoming_hook.channel_id.app_error", nil, "")
	}

	if len(o.TeamId) != 26 {
		return NewLocAppError("IncomingWebhook.IsValid", "model.incoming_hook.team_id.app_error", nil, "")
	}

	if len(o.DisplayName) > 64 {
		return NewLocAppError("IncomingWebhook.IsValid", "model.incoming_hook.display_name.app_error", nil, "")
	}

	if len(o.Description) > 128 {
		return NewLocAppError("IncomingWebhook.IsValid", "model.incoming_hook.description.app_error", nil, "")
	}

	return nil
}

func (o *IncomingWebhook) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
}

func (o *IncomingWebhook) PreUpdate() {
	o.UpdateAt = GetMillis()
}

// escapeControlCharsFromPayload escapes control chars (\n, \t) from a byte slice.
// Context:
// JSON strings are not supposed to contain control characters such as \n, \t,
// ... but some incoming webhooks might still send invalid JSON and we want to
// try to handle that. An example invalid JSON string from an incoming webhook
// might look like this (strings for both "text" and "fallback" attributes are
// invalid JSON strings because they contain unescaped newlines and tabs):
//  `{
//    "text": "this is a test
//						 that contains a newline and tabs",
//    "attachments": [
//      {
//        "fallback": "Required plain-text summary of the attachment
//										that contains a newline and tabs",
//        "color": "#36a64f",
//  			...
//        "text": "Optional text that appears within the attachment
//								 that contains a newline and tabs",
//  			...
//        "thumb_url": "http://example.com/path/to/thumb.png"
//      }
//    ]
//  }`
// This function will search for `"key": "value"` pairs, and escape \n, \t
// from the value.
func escapeControlCharsFromPayload(by []byte) []byte {
	// we'll search for `"text": "..."` or `"fallback": "..."`, ...
	keys := "text|fallback|pretext|author_name|title|value"

	// the regexp reads like this:
	// (?s): this flag let . match \n (default is false)
	// "(keys)": we search for the keys defined above
	// \s*:\s*: followed by 0..n spaces/tabs, a colon then 0..n spaces/tabs
	// ": a double-quote
	// (\\"|[^"])*: any number of times the `\"` string or any char but a double-quote
	// ": a double-quote
	r := `(?s)"(` + keys + `)"\s*:\s*"(\\"|[^"])*"`
	re := regexp.MustCompile(r)

	// the function that will escape \n and \t on the regexp matches
	repl := func(b []byte) []byte {
		if bytes.Contains(b, []byte("\n")) {
			b = bytes.Replace(b, []byte("\n"), []byte("\\n"), -1)
		}
		if bytes.Contains(b, []byte("\t")) {
			b = bytes.Replace(b, []byte("\t"), []byte("\\t"), -1)
		}

		return b
	}

	return re.ReplaceAllFunc(by, repl)
}

func decodeIncomingWebhookRequest(by []byte) (*IncomingWebhookRequest, error) {
	decoder := json.NewDecoder(bytes.NewReader(by))
	var o IncomingWebhookRequest
	err := decoder.Decode(&o)
	if err == nil {
		return &o, nil
	} else {
		return nil, err
	}
}

// To mention @channel via a webhook in Slack, the message should contain
// <!channel>, as explained at the bottom of this article:
// https://get.slack.help/hc/en-us/articles/202009646-Making-announcements
func expandAnnouncement(text string) string {
	c1 := "<!channel>"
	c2 := "@channel"
	if strings.Contains(text, c1) {
		return strings.Replace(text, c1, c2, -1)
	}
	return text
}

// Expand announcements in incoming webhooks from Slack. Those announcements
// can be found in the text attribute, or in the pretext, text, title and value
// attributes of the attachment structure. The Slack attachment structure is
// documented here: https://api.slack.com/docs/attachments
func expandAnnouncements(i *IncomingWebhookRequest) {
	i.Text = expandAnnouncement(i.Text)

	if i.Attachments != nil {
		attachments := i.Attachments.([]interface{})
		for _, attachment := range attachments {
			a := attachment.(map[string]interface{})

			if a["pretext"] != nil {
				a["pretext"] = expandAnnouncement(a["pretext"].(string))
			}

			if a["text"] != nil {
				a["text"] = expandAnnouncement(a["text"].(string))
			}

			if a["title"] != nil {
				a["title"] = expandAnnouncement(a["title"].(string))
			}

			if a["fields"] != nil {
				fields := a["fields"].([]interface{})
				for _, field := range fields {
					f := field.(map[string]interface{})
					if f["value"] != nil {
						f["value"] = expandAnnouncement(f["value"].(string))
					}
				}
			}
		}
	}
}

func IncomingWebhookRequestFromJson(data io.Reader) *IncomingWebhookRequest {
	buf := new(bytes.Buffer)
	buf.ReadFrom(data)
	by := buf.Bytes()

	// Try to decode the JSON data. Only if it fails, try to escape control
	// characters from the strings contained in the JSON data.
	o, err := decodeIncomingWebhookRequest(by)
	if err != nil {
		o, err = decodeIncomingWebhookRequest(escapeControlCharsFromPayload(by))
		if err != nil {
			return nil
		}
	}

	expandAnnouncements(o)

	return o
}
