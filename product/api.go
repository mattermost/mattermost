// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

import (
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

// RouterService enables registering the product router to the server.
type RouterService interface {
	RegisterRouter(productID string, sub *mux.Router)
}

// PostService provides posts related utilities.
type PostService interface {
	CreatePost(context *request.Context, post *model.Post) (*model.Post, *model.AppError)
}

// PermissionService provides users related utilities.
type PermissionService interface {
	HasPermissionToTeam(userID, teamID string, permission *model.Permission) bool
	LogError(productID, msg string, keyValuePairs ...interface{})
}

type ClusterService interface {
	PublishPluginClusterEvent(productID string, ev model.PluginClusterEvent, opts model.PluginClusterEventSendOptions) error
	PublishWebSocketEvent(productID string, event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast)
	SetPluginKeyWithOptions(productID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError)
}

type ChannelService interface {
	GetDirectChannel(userID1, userID2 string) (*model.Channel, *model.AppError)
	GetChannelByID(channelID string) (*model.Channel, *model.AppError)
	GetChannelMember(channelID string, userID string) (*model.ChannelMember, *model.AppError)
}

type LicenseService interface {
	GetLicense() *model.License
	RequestTrialLicense(requesterID string, users int, termsAccepted bool, receiveEmailsAccepted bool) *model.AppError
}

type UserService interface {
	GetUser(userID string) (*model.User, *model.AppError)
	UpdateUser(user *model.User, sendNotifications bool) (*model.User, *model.AppError)
	GetUserByEmail(email string) (*model.User, *model.AppError)
	GetUserByUsername(username string) (*model.User, *model.AppError)
}

type TeamService interface {
	GetMember(teamID, userID string) (*model.TeamMember, error)
	CreateMember(ctx *request.Context, teamID, userID string) (*model.TeamMember, error)
}

type BotService interface {
	EnsureBot(ctx *request.Context, productID string, bot *model.Bot) (string, error)
}

type LogService interface {
	LogError(productID, msg string, keyValuePairs ...interface{})
	LogWarn(productID, msg string, keyValuePairs ...interface{})
	LogDebug(productID, msg string, keyValuePairs ...interface{})
}

type Hooks interface {
	plugin.ProductHooks
}

type HooksService interface {
	RegisterHooks(productID string, hooks Hooks) error
}
