// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bot

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/config"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/playbooks"
)

// Bot stores the information for the plugin configuration, and implements the Poster interfaces.
type Bot struct {
	configService  config.Service
	serviceAdapter playbooks.ServicesAPI
	botUserID      string
	telemetry      Telemetry
}

// Poster interface - a small subset of the plugin posting API.
type Poster interface {
	// Post posts a custom post, which should provide the Message and ChannelId fields
	Post(post *model.Post) error

	// PostMessage posts a simple message to channelID. Returns the post id if posting was successful.
	PostMessage(channelID, format string, args ...interface{}) (*model.Post, error)

	// PostMessageToThread posts a message to a specified channel and thread identified by rootPostID.
	// If the rootPostID is blank, or the rootPost is deleted, it will create a standalone post. The
	// returned post's RootID (or ID, if there was no root post) should be used as the rootID for
	// future use (i.e., save that if you want to continue the thread).
	PostMessageToThread(rootPostID string, post *model.Post) error

	// PostMessageWithAttachments posts a message with slack attachments to channelID. Returns the post id if
	// posting was successful. Often used to include post actions.
	PostMessageWithAttachments(channelID string, attachments []*model.SlackAttachment, format string, args ...interface{}) (*model.Post, error)

	// PostCustomMessageWithAttachments posts a custom message with the specified type. Falling back to attachments for mobile.
	PostCustomMessageWithAttachments(channelID, customType string, attachments []*model.SlackAttachment, format string, args ...interface{}) (*model.Post, error)

	// DM posts a DM from the plugin bot to the specified user
	DM(userID string, post *model.Post) error

	// EphemeralPost sends an ephemeral message to a user.
	EphemeralPost(userID, channelID string, post *model.Post)

	// SystemEphemeralPost sends an ephemeral message to a user authored by the System.
	SystemEphemeralPost(userID, channelID string, post *model.Post)

	// EphemeralPostWithAttachments sends an ephemeral message to a user with Slack attachments.
	EphemeralPostWithAttachments(userID, channelID, rootPostID string, attachments []*model.SlackAttachment, format string, args ...interface{})

	// PublishWebsocketEventToTeam sends a websocket event with payload to teamID.
	PublishWebsocketEventToTeam(event string, payload interface{}, teamID string)

	// PublishWebsocketEventToChannel sends a websocket event with payload to channelID.
	PublishWebsocketEventToChannel(event string, payload interface{}, channelID string)

	// PublishWebsocketEventToUser sends a websocket event with payload to userID.
	PublishWebsocketEventToUser(event string, payload interface{}, userID string)

	// NotifyAdmins sends a DM with the message to each admins
	NotifyAdmins(message, authorUserID string, isTeamEdition bool) error

	// IsFromPoster returns whether the provided post was sent by this poster
	IsFromPoster(post *model.Post) bool
}

type Telemetry interface {
	NotifyAdmins(userID string, action string)
	StartTrial(userID string, action string)
}

// New creates a new bot poster.
func New(serviceAdapter playbooks.ServicesAPI, botUserID string, configService config.Service, telemetry Telemetry) *Bot {
	return &Bot{
		serviceAdapter: serviceAdapter,
		botUserID:      botUserID,
		configService:  configService,
		telemetry:      telemetry,
	}
}
