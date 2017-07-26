// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
	"strings"
)

type SlackAttachment struct {
	Id         int64                   `json:"id"`
	Fallback   string                  `json:"fallback"`
	Color      string                  `json:"color"`
	Pretext    string                  `json:"pretext"`
	AuthorName string                  `json:"author_name"`
	AuthorLink string                  `json:"author_link"`
	AuthorIcon string                  `json:"author_icon"`
	Title      string                  `json:"title"`
	TitleLink  string                  `json:"title_link"`
	Text       string                  `json:"text"`
	Fields     []*SlackAttachmentField `json:"fields"`
	ImageURL   string                  `json:"image_url"`
	ThumbURL   string                  `json:"thumb_url"`
	Footer     string                  `json:"footer"`
	FooterIcon string                  `json:"footer_icon"`
	Timestamp  interface{}             `json:"ts"` // This is either a string or an int64
}

type SlackAttachmentField struct {
	Title string      `json:"title"`
	Value interface{} `json:"value"`
	Short bool        `json:"short"`
}

// To mention @channel via a webhook in Slack, the message should contain
// <!channel>, as explained at the bottom of this article:
// https://get.slack.help/hc/en-us/articles/202009646-Making-announcements
func ExpandAnnouncement(text string) string {
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
func ProcessSlackAttachments(a []*SlackAttachment) []*SlackAttachment {
	var nonNilAttachments []*SlackAttachment
	for _, attachment := range a {
		if attachment == nil {
			continue
		}
		nonNilAttachments = append(nonNilAttachments, attachment)

		attachment.Pretext = ExpandAnnouncement(attachment.Pretext)
		attachment.Text = ExpandAnnouncement(attachment.Text)
		attachment.Title = ExpandAnnouncement(attachment.Title)

		var nonNilFields []*SlackAttachmentField
		for _, field := range attachment.Fields {
			if field == nil {
				continue
			}
			nonNilFields = append(nonNilFields, field)

			if field.Value != nil {
				// Ensure the value is set to a string if it is set
				field.Value = ExpandAnnouncement(fmt.Sprintf("%v", field.Value))
			}
		}
		attachment.Fields = nonNilFields
	}
	return nonNilAttachments
}
