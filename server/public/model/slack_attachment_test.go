// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSlackAttachment_IsValid(t *testing.T) {
	tests := map[string]struct {
		attachment *SlackAttachment
		wantErr    string
	}{
		"valid attachment": {
			attachment: &SlackAttachment{
				Text: "This is a test",
			},
			wantErr: "",
		},
		"invalid color": {
			attachment: &SlackAttachment{
				Color: "invalid",
			},
			wantErr: "invalid style 'invalid' - must be one of [good, warning, danger] or a hex color",
		},
		"valid predefined color": {
			attachment: &SlackAttachment{
				Color: "good",
			},
			wantErr: "",
		},
		"valid warning color": {
			attachment: &SlackAttachment{
				Color: "warning",
			},
			wantErr: "",
		},
		"valid danger color": {
			attachment: &SlackAttachment{
				Color: "danger",
			},
			wantErr: "",
		},
		"valid hex color": {
			attachment: &SlackAttachment{
				Color: "#FF0000",
			},
			wantErr: "",
		},
		"author link without name": {
			attachment: &SlackAttachment{
				AuthorLink: "http://example.com",
			},
			wantErr: "author link cannot be set without author name",
		},
		"invalid author link": {
			attachment: &SlackAttachment{
				AuthorName: "Author",
				AuthorLink: "invalid-url",
			},
			wantErr: "invalid author link URL",
		},
		"invalid author icon": {
			attachment: &SlackAttachment{
				AuthorIcon: "invalid-url",
			},
			wantErr: "invalid author icon URL",
		},
		"title link without title": {
			attachment: &SlackAttachment{
				TitleLink: "http://example.com",
			},
			wantErr: "title link cannot be set without title",
		},
		"invalid title link": {
			attachment: &SlackAttachment{
				Title:     "Title",
				TitleLink: "invalid-url",
			},
			wantErr: "invalid title link URL",
		},
		"invalid image URL": {
			attachment: &SlackAttachment{
				ImageURL: "invalid-url",
			},
			wantErr: "invalid image URL",
		},
		"invalid thumb URL": {
			attachment: &SlackAttachment{
				ThumbURL: "invalid-url",
			},
			wantErr: "invalid thumb URL",
		},
		"invalid footer icon": {
			attachment: &SlackAttachment{
				FooterIcon: "invalid-url",
			},
			wantErr: "invalid footer icon URL",
		},
		"invalid timestamp type": {
			attachment: &SlackAttachment{
				Timestamp: []string{"invalid"},
			},
			wantErr: "timestamp must be either a string or int64",
		},
		"valid timestamp string": {
			attachment: &SlackAttachment{
				Timestamp: "1234567890",
			},
			wantErr: "",
		},
		"valid timestamp int64": {
			attachment: &SlackAttachment{
				Timestamp: int64(1234567890),
			},
			wantErr: "",
		},
		"invalid action": {
			attachment: &SlackAttachment{
				Actions: []*PostAction{
					{
						Name: "", // Invalid - missing name
					},
				},
			},
			wantErr: "action must have a name",
		},
		"invalid field value type": {
			attachment: &SlackAttachment{
				Fields: []*SlackAttachmentField{
					{
						Title: "Title",
						Value: []string{"invalid"},
					},
				},
			},
			wantErr: "value must be either a string or int",
		},
		"valid fields": {
			attachment: &SlackAttachment{
				Fields: []*SlackAttachmentField{
					{
						Title: "Title",
						Value: "string value",
					},
					{
						Title: "Number",
						Value: 42,
					},
				},
			},
			wantErr: "",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			err := tc.attachment.IsValid()
			if tc.wantErr == "" {
				assert.NoError(t, err, name)
			} else {
				assert.ErrorContains(t, err, tc.wantErr, name)
			}
		})
	}
}

func TestParseSlackAttachment(t *testing.T) {
	t.Run("empty list", func(t *testing.T) {
		post := &Post{}
		attachments := []*SlackAttachment{}

		ParseSlackAttachment(post, attachments)

		expectedPost := &Post{
			Type: PostTypeSlackAttachment,
			Props: map[string]any{
				PostPropsAttachments: []*SlackAttachment{},
			},
		}
		assert.Equal(t, expectedPost, post)
	})

	t.Run("list with nil", func(t *testing.T) {
		post := &Post{}
		attachments := []*SlackAttachment{
			nil,
		}

		ParseSlackAttachment(post, attachments)

		expectedPost := &Post{
			Type: PostTypeSlackAttachment,
			Props: map[string]any{
				PostPropsAttachments: []*SlackAttachment{},
			},
		}
		assert.Equal(t, expectedPost, post)
	})
}
