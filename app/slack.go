// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"regexp"

	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func (a *App) ProcessSlackText(text string) string {
	text = expandAnnouncement(text)
	text = replaceUserIds(a.Srv.Store.User(), text)

	return text
}

// Expand announcements in incoming webhooks from Slack. Those announcements
// can be found in the text attribute, or in the pretext, text, title and value
// attributes of the attachment structure. The Slack attachment structure is
// documented here: https://api.slack.com/docs/attachments
func (app *App) ProcessSlackAttachments(a []*model.SlackAttachment) []*model.SlackAttachment {
	var nonNilAttachments = model.StringifySlackFieldValue(a)
	for _, attachment := range a {
		attachment.Pretext = app.ProcessSlackText(attachment.Pretext)
		attachment.Text = app.ProcessSlackText(attachment.Text)
		attachment.Title = app.ProcessSlackText(attachment.Title)

		for _, field := range attachment.Fields {
			if field.Value != nil {
				// Ensure the value is set to a string if it is set
				field.Value = app.ProcessSlackText(fmt.Sprintf("%v", field.Value))
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
func replaceUserIds(userStore store.UserStore, text string) string {
	rgx, err := regexp.Compile("<@([a-zA-Z0-9]+)>")
	if err == nil {
		userIds := make([]string, 0)
		matches := rgx.FindAllStringSubmatch(text, -1)
		for _, match := range matches {
			userIds = append(userIds, match[1])
		}

		if res := <-userStore.GetProfileByIds(userIds, true, nil); res.Err == nil {
			for _, user := range res.Data.([]*model.User) {
				text = strings.Replace(text, "<@"+user.Id+">", "@"+user.Username, -1)
			}
		}
	}
	return text
}
