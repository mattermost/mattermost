// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) ProcessSlackText(rctx request.CTX, text string) string {
	text = expandAnnouncement(text)
	text = replaceUserIds(rctx, a.Srv().Store().User(), text)

	return text
}

// Expand announcements in incoming webhooks from Slack. Those announcements
// can be found in the text attribute, or in the pretext, text, title and value
// attributes of the attachment structure. The message attachment structure is
// documented here: https://developers.mattermost.com/integrate/reference/message-attachments/.
// It's based on the spec from slack: https://api.slack.com/docs/attachments.
func (a *App) ProcessMessageAttachments(rctx request.CTX, attachments []*model.MessageAttachment) []*model.MessageAttachment {
	var nonNilAttachments = model.StringifyMessageAttachmentFieldValue(attachments)
	for _, attachment := range nonNilAttachments {
		attachment.Pretext = a.ProcessSlackText(rctx, attachment.Pretext)
		attachment.Text = a.ProcessSlackText(rctx, attachment.Text)
		attachment.Title = a.ProcessSlackText(rctx, attachment.Title)

		for _, field := range attachment.Fields {
			if field != nil && field.Value != nil {
				// Ensure the value is set to a string if it is set
				field.Value = a.ProcessSlackText(rctx, fmt.Sprintf("%v", field.Value))
			}
		}
	}
	return nonNilAttachments
}

// To mention @channel or @here via a webhook in Slack, the message should contain
// <!channel> or <!here>, as explained at the bottom of this article:
// https://get.slack.help/hc/en-us/articles/202009646-Making-announcements
func expandAnnouncement(text string) string {
	a1 := [3]string{"<!channel>", "<!here>", "<!all>"}
	a2 := [3]string{"@channel", "@here", "@all"}

	for i, a := range a1 {
		text = strings.Replace(text, a, a2[i], -1)
	}
	return text
}

// Replaces user IDs mentioned like this <@userID> to a normal username (eg. @bob)
// This is required so that Mattermost maintains Slack compatibility
// Refer to: https://api.slack.com/changelog/2017-09-the-one-about-usernames
func replaceUserIds(rctx request.CTX, userStore store.UserStore, text string) string {
	rgx, err := regexp.Compile("<@([a-zA-Z0-9]+)>")
	if err == nil {
		userIDs := make([]string, 0)
		matches := rgx.FindAllStringSubmatch(text, -1)
		for _, match := range matches {
			userIDs = append(userIDs, match[1])
		}

		if users, err := userStore.GetProfileByIds(rctx, userIDs, nil, true); err == nil {
			for _, user := range users {
				text = strings.Replace(text, "<@"+user.Id+">", "@"+user.Username, -1)
			}
		}
	}
	return text
}
