// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"mime/multipart"
	"regexp"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/slackimport"
	"github.com/mattermost/mattermost-server/v6/store"
)

func (a *App) SlackImport(c *request.Context, fileData multipart.File, fileSize int64, teamID string) (*model.AppError, *bytes.Buffer) {
	actions := slackimport.Actions{
		UpdateActive: func(user *model.User, active bool) (*model.User, *model.AppError) {
			return a.UpdateActive(c, user, active)
		},
		AddUserToChannel: a.AddUserToChannel,
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			return a.JoinUserToTeam(c, team, user, userRequestorId)
		},
		CreateDirectChannel: a.createDirectChannel,
		CreateGroupChannel:  a.createGroupChannel,
		CreateChannel: func(channel *model.Channel, addMember bool) (*model.Channel, *model.AppError) {
			return a.CreateChannel(c, channel, addMember)
		},
		DoUploadFile: func(now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte) (*model.FileInfo, *model.AppError) {
			return a.DoUploadFile(c, now, rawTeamId, rawChannelId, rawUserId, rawFilename, data)
		},
		GenerateThumbnailImage: a.generateThumbnailImage,
		GeneratePreviewImage:   a.generatePreviewImage,
		InvalidateAllCaches:    func() { a.ch.srv.InvalidateAllCaches() },
		MaxPostSize:            func() int { return a.ch.srv.MaxPostSize() },
		PrepareImage: func(fileData []byte) (image.Image, func(), error) {
			img, release, err := prepareImage(a.ch.imgDecoder, bytes.NewReader(fileData))
			if err != nil {
				return nil, nil, err
			}
			return img, release, err
		},
	}

	importer := slackimport.New(a.ch.srv.Store, actions, a.Config())
	return importer.SlackImport(c, fileData, fileSize, teamID)
}

func (a *App) ProcessSlackText(text string) string {
	text = expandAnnouncement(text)
	text = replaceUserIds(a.Srv().Store.User(), text)

	return text
}

// Expand announcements in incoming webhooks from Slack. Those announcements
// can be found in the text attribute, or in the pretext, text, title and value
// attributes of the attachment structure. The Slack attachment structure is
// documented here: https://api.slack.com/docs/attachments
func (a *App) ProcessSlackAttachments(attachments []*model.SlackAttachment) []*model.SlackAttachment {
	var nonNilAttachments = model.StringifySlackFieldValue(attachments)
	for _, attachment := range attachments {
		attachment.Pretext = a.ProcessSlackText(attachment.Pretext)
		attachment.Text = a.ProcessSlackText(attachment.Text)
		attachment.Title = a.ProcessSlackText(attachment.Title)

		for _, field := range attachment.Fields {
			if field != nil && field.Value != nil {
				// Ensure the value is set to a string if it is set
				field.Value = a.ProcessSlackText(fmt.Sprintf("%v", field.Value))
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
		userIDs := make([]string, 0)
		matches := rgx.FindAllStringSubmatch(text, -1)
		for _, match := range matches {
			userIDs = append(userIDs, match[1])
		}

		if users, err := userStore.GetProfileByIds(context.Background(), userIDs, nil, true); err == nil {
			for _, user := range users {
				text = strings.Replace(text, "<@"+user.Id+">", "@"+user.Username, -1)
			}
		}
	}
	return text
}
