// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

import (
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

// RouterService enables registering the product router to the server. After registering the
// router, the ServeHTTP hook which was being used in plugin mode is not required anymore.
// For now, the service implementation is provided by Channels therefore the consumer products
// should add this service key to their dependencies map in the app.ProductManifest.
//
// The service shall be registered via app.RouterKey service key.
type RouterService interface {
	RegisterRouter(productID string, sub *mux.Router)
}

// PostService provides posts related utilities.  For now, the service implementation
// is provided by Channels therefore the consumer products should add this service key to
// their dependencies map in the app.ProductManifest.
//
// The service shall be registered via app.PostKey service key.
type PostService interface {
	CreatePost(context *request.Context, post *model.Post) (*model.Post, *model.AppError)
}

// PermissionService provides permissions related utilities. For now, the service implementation
// is provided by Channels therefore the consumer products should add this service key to their
// dependencies map in the app.ProductManifest.
//
// The service shall be registered via app.PermissionKey service key.
type PermissionService interface {
	HasPermissionToTeam(userID, teamID string, permission *model.Permission) bool
}

// ClusterService enables to publish cluster events. In addition to that, It's being used for
// mattermost-plugin-api Mutex API with the SetPluginKeyWithOptions method.
//
// The service shall be registered via app.ClusterKey key.
type ClusterService interface {
	PublishPluginClusterEvent(productID string, ev model.PluginClusterEvent, opts model.PluginClusterEventSendOptions) error
	PublishWebSocketEvent(productID string, event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast)
	SetPluginKeyWithOptions(productID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError)
}

// ChannelService provides channel related API  The service implementation is provided by
// Channels product therefore the consumer products should add this service key to their
// dependencies map in the app.ProductManifest.
//
// The service shall be registered via app.ChannelKey service key.
type ChannelService interface {
	GetDirectChannel(userID1, userID2 string) (*model.Channel, *model.AppError)
	GetChannelByID(channelID string) (*model.Channel, *model.AppError)
	GetChannelMember(channelID string, userID string) (*model.ChannelMember, *model.AppError)
}

// LicenseService provides license related utilities.
//
// The service shall be registered via app.LicenseKey service key.
type LicenseService interface {
	GetLicense() *model.License
	RequestTrialLicense(requesterID string, users int, termsAccepted bool, receiveEmailsAccepted bool) *model.AppError
}

// UserService provides user related utilities. Initially this was thought to be app/users.UserService
// but it's replaced by app.App temporarily. The reason is; UserService is a standalone tool whereas the
// existing plugin API was using channels related app functionalities as well. We shall improve the UserService
// to meet emerging requirements.
//
// The service shall be registered via app.UserKey service key.
type UserService interface {
	GetUser(userID string) (*model.User, *model.AppError)
	UpdateUser(user *model.User, sendNotifications bool) (*model.User, *model.AppError)
	GetUserByEmail(email string) (*model.User, *model.AppError)
	GetUserByUsername(username string) (*model.User, *model.AppError)
}

// TeamService provides team related utilities.
//
// The service shall be registered via app.TeamKey service key.
type TeamService interface {
	GetMember(teamID, userID string) (*model.TeamMember, error)
	CreateMember(ctx *request.Context, teamID, userID string) (*model.TeamMember, error)
}

// BotService is just a copy implementation of mattermost-plugin-api EnsureBot method.
//
// The service shall be registered via app.BotKey service key.
type BotService interface {
	EnsureBot(ctx *request.Context, productID string, bot *model.Bot) (string, error)
}

// LogService shall be registered via app.LogKey service key.
type LogService interface {
	LogError(productID, msg string, keyValuePairs ...interface{})
	LogWarn(productID, msg string, keyValuePairs ...interface{})
	LogDebug(productID, msg string, keyValuePairs ...interface{})
}

// Hooks is an interim solution for enabling plugin hooks on the multi-product architecture. After the
// focalboard migration is completed, this API should replaced with something else that would enable a
// product to register any hook. Currently this is added to unblock the migration.
type Hooks interface {
	plugin.ProductHooks
}

// HooksService is the API for adding exiting plugin hooks to the server so that they can be called as
// they were. This Service is required to be used after the products start. Otherwise it will return an error.
//
// The service shall be registered via app.HooksKey service key.
type HooksService interface {
	RegisterHooks(productID string, hooks Hooks) error
}
