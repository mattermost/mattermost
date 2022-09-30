// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
	Timestamp  any                     `json:"ts"` // This is either a string or an int64
	Actions    []*PostAction           `json:"actions,omitempty"`
}

func (s *SlackAttachment) Equals(input *SlackAttachment) bool {
	// Direct comparison of simple types

	if s.Id != input.Id {
		return false
	}

	if s.Fallback != input.Fallback {
		return false
	}

	if s.Color != input.Color {
		return false
	}

	if s.Pretext != input.Pretext {
		return false
	}

	if s.AuthorName != input.AuthorName {
		return false
	}

	if s.AuthorLink != input.AuthorLink {
		return false
	}

	if s.AuthorIcon != input.AuthorIcon {
		return false
	}

	if s.Title != input.Title {
		return false
	}

	if s.TitleLink != input.TitleLink {
		return false
	}

	if s.Text != input.Text {
		return false
	}

	if s.ImageURL != input.ImageURL {
		return false
	}

	if s.ThumbURL != input.ThumbURL {
		return false
	}

	if s.Footer != input.Footer {
		return false
	}

	if s.FooterIcon != input.FooterIcon {
		return false
	}

	// Compare length & slice values of fields
	if len(s.Fields) != len(input.Fields) {
		return false
	}

	for j := range s.Fields {
		if !s.Fields[j].Equals(input.Fields[j]) {
			return false
		}
	}

	// Compare length & slice values of actions
	if len(s.Actions) != len(input.Actions) {
		return false
	}

	for j := range s.Actions {
		if !s.Actions[j].Equals(input.Actions[j]) {
			return false
		}
	}

	return s.Timestamp == input.Timestamp
}

type SlackAttachmentField struct {
	Title string              `json:"title"`
	Value any                 `json:"value"`
	Short SlackCompatibleBool `json:"short"`
}

func (s *SlackAttachmentField) Equals(input *SlackAttachmentField) bool {
	if s.Title != input.Title {
		return false
	}

	if s.Value != input.Value {
		return false
	}

	if s.Short != input.Short {
		return false
	}

	return true
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
	if post.Type == "" {
		post.Type = PostTypeSlackAttachment
	}

	postAttachments := []*SlackAttachment{}

	for _, attachment := range attachments {
		if attachment == nil {
			continue
		}

		attachment.Text = ParseSlackLinksToMarkdown(attachment.Text)
		attachment.Pretext = ParseSlackLinksToMarkdown(attachment.Pretext)

		for _, field := range attachment.Fields {
			if field == nil {
				continue
			}
			if value, ok := field.Value.(string); ok {
				field.Value = ParseSlackLinksToMarkdown(value)
			}
		}
		postAttachments = append(postAttachments, attachment)
	}
	post.AddProp("attachments", postAttachments)
}

func ParseSlackLinksToMarkdown(text string) string {
	return linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")
}
