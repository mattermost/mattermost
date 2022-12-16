// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

import (
	"database/sql"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"

	fb_model "github.com/mattermost/focalboard/server/model"
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
	HasPermissionTo(userID string, permission *model.Permission) bool
	HasPermissionToTeam(userID, teamID string, permission *model.Permission) bool
	HasPermissionToChannel(askingUserID string, channelID string, permission *model.Permission) bool
}

// ClusterService enables to publish cluster events. In addition to that, It's being used for
// mattermost-plugin-api Mutex API with the SetPluginKeyWithOptions method.
//
// The service shall be registered via app.ClusterKey key.
type ClusterService interface {
	PublishPluginClusterEvent(productID string, ev model.PluginClusterEvent, opts model.PluginClusterEventSendOptions) error
	PublishWebSocketEvent(productID string, event string, payload map[string]any, broadcast *model.WebsocketBroadcast)
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
	GetChannelsForTeamForUser(teamID string, userID string, opts *model.ChannelSearchOpts) (model.ChannelList, *model.AppError)
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
	UpdateUser(c request.CTX, user *model.User, sendNotifications bool) (*model.User, *model.AppError)
	GetUserByEmail(email string) (*model.User, *model.AppError)
	GetUserByUsername(username string) (*model.User, *model.AppError)
	GetUsersFromProfiles(options *model.UserGetOptions) ([]*model.User, *model.AppError)
}

// TeamService provides team related utilities.
//
// The service shall be registered via app.TeamKey service key.
type TeamService interface {
	GetMember(teamID, userID string) (*model.TeamMember, *model.AppError)
	CreateMember(ctx *request.Context, teamID, userID string) (*model.TeamMember, *model.AppError)
}

// BotService is just a copy implementation of mattermost-plugin-api EnsureBot method.
//
// The service shall be registered via app.BotKey service key.
type BotService interface {
	EnsureBot(ctx *request.Context, productID string, bot *model.Bot) (string, error)
}

// ConfigService shall be registered via app.ConfigKey service key.
type ConfigService interface {
	Config() *model.Config
	AddConfigListener(listener func(*model.Config, *model.Config)) string
	RemoveConfigListener(id string)
	UpdateConfig(f func(*model.Config))
	SaveConfig(newCfg *model.Config, sendConfigChangeClusterMessage bool) (*model.Config, *model.Config, *model.AppError)
}

// HooksService is the API for adding exiting plugin hooks to the server so that they can be called as
// they were. This Service is required to be accessed after the channels product initialized.
//
// The service shall be registered via app.HooksKey service key.
type HooksService interface {
	// RegisterHook checks whether if the 'hooks' implements any method of plugin.Hooks methods. Rather than
	// using the whole plugin.Hooks interface with its 20+ methods, a product can implement any exiting method
	// of plugin.Hooks w/o requiring to declare which method they implemented or not. This is going to be
	// checked on runtime. We have individual interfaces for each method declared in plugin.Hooks interface.
	// Hence, while registering a product, the service will check if the product implements any of these individual
	// interfaces. If so, a map of hook IDs that are implemented will be used to call the hooks. The method will
	// return an error in case if there is an incorrect implementation of the any of the individual interface in runtime.
	// Consider checking plugin.Hooks for the reference.
	// Following methods are not allowed to be implemented in the product:
	//  - plugin.Hooks.OnActivate
	//  - plugin.Hooks.OnDeactivate
	//  - plugin.Hooks.Implemented
	//  - plugin.Hooks.ServeHTTP
	RegisterHooks(productID string, hooks any) error
}

// FilestoreService is the API for accessing the file store.
//
// The service shall be registered via app.FilestoreKey service key.
type FilestoreService interface {
	filestore.FileBackend
}

// FileInfoStoreService is the API for accessing the file info store.
//
// The service shall be registered via app.FileInfoStoreKey service key.
type FileInfoStoreService interface {
	GetFileInfo(fileID string) (*model.FileInfo, *model.AppError)
}

// CloudService is the API for accessing the cloud service APIs.
//
// The service shall be registered via app.CloudKey service key.
type CloudService interface {
	GetCloudLimits() (*model.ProductLimits, error)
}

// KVStoreService is the API for accessing the KVStore service APIs.
//
// The service shall be registered via app.KVStoreKey service key.
type KVStoreService interface {
	SetPluginKeyWithOptions(pluginID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError)
}

// LogService is the API for accessing the log service APIs.
//
// The service shall be registered via app.LogKey service key.
type LogService interface {
	mlog.LoggerIFace
}

// StoreService is the API for accessing the Store service APIs.
//
// The service shall be registered via app.StoreKey service key.
type StoreService interface {
	GetMasterDB() *sql.DB
}

// SystemService is the API for accessing the System service APIs.
//
// The service shall be registered via app.SystemKey service key.
type SystemService interface {
	GetDiagnosticId() string
}

// PreferencesService is the API for accessing the Preferences service APIs.
//
// The service shall be registered via app.PreferencesKey service key.
type PreferencesService interface {
	GetPreferencesForUser(userID string) (model.Preferences, *model.AppError)
	UpdatePreferencesForUser(userID string, preferences model.Preferences) *model.AppError
	DeletePreferencesForUser(userID string, preferences model.Preferences) *model.AppError
}

// BoardsService is the API for accessing Boards service APIs.
//
// The service shall be registered via app.BoardsKey service key.
type BoardsService interface {
	GetTemplates(teamID string) ([]*fb_model.Board, error)
	GetBoard(boardID string) (*fb_model.Board, error)
	CreateBoard(board *fb_model.Board) (*fb_model.Board, error)
	PatchBoard(boardID string, boardPatch *fb_model.BoardPatch) (*fb_model.Board, error)
	DeleteBoard(boardID string) error
	SearchBoards(teamID string, searchField fb_model.BoardSearchField, searchTerm string) ([]*fb_model.Board, error)
	LinkBoardToChannel(boardID string, channelID string) (*fb_model.Board, error)
	GetCards(boardID string, userID string) ([]*fb_model.Card, error)
	GetCard(cardID string) (*fb_model.Card, error)
	CreateCard(boardID string, userID string, card *fb_model.Card, disableNotify bool) (*fb_model.Card, error)
	PatchCard(cardID string, cardPatch *fb_model.CardPatch) (*fb_model.Card, error)
}
