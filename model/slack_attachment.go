// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
	"regexp"
)

var linkWithTextRegex = regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)

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
	Actions    []*PostAction           `json:"actions,omitempty"`
}

type SlackAttachmentField struct {
	Title string      `json:"title"`
	Value interface{} `json:"value"`
	Short bool        `json:"short"`
}

func StringifySlackFieldValue(a []*SlackAttachment) []*SlackAttachment {
	var nonNilAttachments []*SlackAttachment
	for _, attachment := range a {
		if attachment == nil {
			continue
		}
		nonNilAttachments = append(nonNilAttachments, attachment)

		var nonNilFields []*SlackAttachmentField
		for _, field := range attachment.Fields {
			if field == nil {
				continue
			}
			nonNilFields = append(nonNilFields, field)

			if field.Value != nil {
				// Ensure the value is set to a string if it is set
				field.Value = fmt.Sprintf("%v", field.Value)
			}
		}
		attachment.Fields = nonNilFields
	}
	return nonNilAttachments
}

// This method only parses and processes the attachments,
// all else should be set in the post which is passed
func ParseSlackAttachment(post *Post, attachments []*SlackAttachment) {
	post.Type = POST_SLACK_ATTACHMENT

	for _, attachment := range attachments {
		attachment.Text = ParseSlackLinksToMarkdown(attachment.Text)
		attachment.Pretext = ParseSlackLinksToMarkdown(attachment.Pretext)

		for _, field := range attachment.Fields {
			if value, ok := field.Value.(string); ok {
				field.Value = ParseSlackLinksToMarkdown(value)
			}
		}
	}
	post.AddProp("attachments", attachments)
}

func ParseSlackLinksToMarkdown(text string) string {
	return linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")
}
