// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/model"
)

func TestProcessMessageAttachments(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := &model.Post{
		Message: "This is the message",
	}

	messageAttachments := []*model.SlackAttachment{
		{
			Color:      "#FF0000",
			Pretext:    "message attachment 1 pretext",
			AuthorName: "author name",
			AuthorLink: "https://example.com/slack_attachment_1/author_link",
			AuthorIcon: "https://example.com/slack_attachment_1/author_icon",
			Title:      "message attachment 1 title",
			TitleLink:  "https://example.com/slack_attachment_1/title_link",
			Text:       "message attachment 1 text",
			ImageURL:   "https://example.com/slack_attachment_1/image",
			ThumbURL:   "https://example.com/slack_attachment_1/thumb",
			Fields: []*model.SlackAttachmentField{
				{
					Short: true,
					Title: "message attachment 1 field 1 title",
					Value: "message attachment 1 field 1 value",
				},
				{
					Short: false,
					Title: "message attachment 1 field 2 title",
					Value: "message attachment 1 field 2 value",
				},
				{
					Short: true,
					Title: "message attachment 1 field 3 title",
					Value: "message attachment 1 field 3 value",
				},
				{
					Short: true,
					Title: "message attachment 1 field 4 title",
					Value: "message attachment 1 field 4 value",
				},
			},
		},
		{
			Color:      "#FF0000",
			Pretext:    "message attachment 2 pretext",
			AuthorName: "author name 2",
			Text:       "message attachment 2 text",
		},
	}

	model.ParseSlackAttachment(post, messageAttachments)

	processedAttachmentsPost := ProcessMessageAttachments(post, "https://example.com")
	require.NotNil(t, processedAttachmentsPost)
	require.Len(t, processedAttachmentsPost, 2)
	require.Equal(t, processedAttachmentsPost[0].Color, "#FF0000")
	require.Equal(t, processedAttachmentsPost[0].FieldRows[0].Cells[0].Title, "message attachment 1 field 1 title")
	require.Equal(t, processedAttachmentsPost[1].Color, "#FF0000")
}
