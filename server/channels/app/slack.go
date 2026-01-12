// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"image"
	"mime/multipart"
	"regexp"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/slackimport"
)

func (a *App) SlackImport(rctx request.CTX, fileData multipart.File, fileSize int64, teamID string) (*model.AppError, *bytes.Buffer) {
	actions := slackimport.Actions{
		UpdateActive: func(user *model.User, active bool) (*model.User, *model.AppError) {
			return a.UpdateActive(rctx, user, active)
		},
		AddUserToChannel: a.AddUserToChannel,
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			return a.JoinUserToTeam(rctx, team, user, userRequestorId)
		},
		CreateDirectChannel: a.createDirectChannel,
		CreateGroupChannel:  a.createGroupChannel,
		CreateChannel: func(channel *model.Channel, addMember bool) (*model.Channel, *model.AppError) {
			return a.CreateChannel(rctx, channel, addMember)
		},
		DoUploadFile: func(now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte) (*model.FileInfo, *model.AppError) {
			return a.DoUploadFile(rctx, now, rawTeamId, rawChannelId, rawUserId, rawFilename, data, true)
		},
		GenerateThumbnailImage: a.generateThumbnailImage,
		GeneratePreviewImage:   a.generatePreviewImage,
		InvalidateAllCaches:    func() *model.AppError { return a.ch.srv.platform.InvalidateAllCaches() },
		MaxPostSize:            func() int { return a.ch.srv.platform.MaxPostSize() },
		PrepareImage: func(fileData []byte) (image.Image, string, func(), error) {
			img, imgType, release, err := prepareImage(rctx, a.ch.imgDecoder, bytes.NewReader(fileData))
			if err != nil {
				return nil, "", nil, err
			}
			return img, imgType, release, err
		},
	}

	// Determine if this is an Admin import:
	// mattermost cmd imports (no session) are treated as admin imports since only server admins can run them
	// Web imports (include mmctl calls) check the actual user's role
	isAdminImport := false

	if rctx.Session() == nil {
		// no session means it's being run directly on the server and only
		// server admins can run CLI commands, so treat as admin import
		isAdminImport = true
		rctx.Logger().Info("Slack import initiated via CLI, treating as admin import")
	} else if rctx.Session().UserId != "" {
		// Web API + mmctl import - check if the user is a system admin
		if user, err := a.GetUser(rctx.Session().UserId); err == nil {
			isAdminImport = user.IsSystemAdmin()
		}
	}

	importer := slackimport.NewWithAdminFlag(a.Srv().Store(), actions, a.Config(), isAdminImport)
	return importer.SlackImport(rctx, fileData, fileSize, teamID)
}

func (a *App) ProcessSlackText(rctx request.CTX, text string) string {
	text = expandAnnouncement(text)
	text = replaceUserIds(rctx, a.Srv().Store().User(), text)

	return text
}

// Expand announcements in incoming webhooks from Slack. Those announcements
// can be found in the text attribute, or in the pretext, text, title and value
// attributes of the attachment structure. The Slack attachment structure is
// documented here: https://api.slack.com/docs/attachments
func (a *App) ProcessSlackAttachments(rctx request.CTX, attachments []*model.SlackAttachment) []*model.SlackAttachment {
	var nonNilAttachments = model.StringifySlackFieldValue(attachments)
	for _, attachment := range attachments {
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
