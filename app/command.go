// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
)

func CreateCommandPost(post *model.Post, teamId string, response *model.CommandResponse, siteURL string) (*model.Post, *model.AppError) {
	post.Message = parseSlackLinksToMarkdown(response.Text)
	post.CreateAt = model.GetMillis()

	if response.Attachments != nil {
		parseSlackAttachment(post, response.Attachments)
	}

	switch response.ResponseType {
	case model.COMMAND_RESPONSE_TYPE_IN_CHANNEL:
		return CreatePost(post, teamId, true, siteURL)
	case model.COMMAND_RESPONSE_TYPE_EPHEMERAL:
		if response.Text == "" {
			return post, nil
		}

		post.ParentId = ""
		SendEphemeralPost(teamId, post.UserId, post)
	}

	return post, nil
}
