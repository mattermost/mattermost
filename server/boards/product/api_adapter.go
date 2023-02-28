// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

import (
	"database/sql"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/channels/app/request"
	mm_model "github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

// normalizeAppError returns a truly nil error if appErr is nil
// See https://golang.org/doc/faq#nil_error for more details.
func normalizeAppErr(appErr *mm_model.AppError) error {
	if appErr == nil {
		return nil
	}
	return appErr
}

// serviceAPIAdapter is an adapter that flattens the APIs provided by suite services so they can
// be used as per the Plugin API.
// Note: when supporting a plugin build is no longer needed this adapter may be removed as the Boards app
// can be modified to use the services in modular fashion.
type serviceAPIAdapter struct {
	api *boardsProduct
	ctx *request.Context
}

func newServiceAPIAdapter(api *boardsProduct) *serviceAPIAdapter {
	return &serviceAPIAdapter{
		api: api,
		ctx: request.EmptyContext(api.logger),
	}
}

//
// Channels service.
//

func (a *serviceAPIAdapter) GetDirectChannel(userID1, userID2 string) (*mm_model.Channel, error) {
	channel, appErr := a.api.channelService.GetDirectChannel(userID1, userID2)
	return channel, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) GetDirectChannelOrCreate(userID1, userID2 string) (*mm_model.Channel, error) {
	channel, appErr := a.api.channelService.GetDirectChannelOrCreate(userID1, userID2)
	return channel, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) GetChannelByID(channelID string) (*mm_model.Channel, error) {
	channel, appErr := a.api.channelService.GetChannelByID(channelID)
	return channel, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) GetChannelMember(channelID string, userID string) (*mm_model.ChannelMember, error) {
	member, appErr := a.api.channelService.GetChannelMember(channelID, userID)
	return member, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) GetChannelsForTeamForUser(teamID string, userID string, includeDeleted bool) (mm_model.ChannelList, error) {
	opts := &mm_model.ChannelSearchOpts{
		IncludeDeleted: includeDeleted,
	}
	channels, appErr := a.api.channelService.GetChannelsForTeamForUser(teamID, userID, opts)
	return channels, normalizeAppErr(appErr)
}

//
// Post service.
//

func (a *serviceAPIAdapter) CreatePost(post *mm_model.Post) (*mm_model.Post, error) {
	post, appErr := a.api.postService.CreatePost(a.ctx, post)
	return post, normalizeAppErr(appErr)
}

//
// User service.
//

func (a *serviceAPIAdapter) GetUserByID(userID string) (*mm_model.User, error) {
	user, appErr := a.api.userService.GetUser(userID)
	return user, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) GetUserByUsername(name string) (*mm_model.User, error) {
	user, appErr := a.api.userService.GetUserByUsername(name)
	return user, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) GetUserByEmail(email string) (*mm_model.User, error) {
	user, appErr := a.api.userService.GetUserByEmail(email)
	return user, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) UpdateUser(user *mm_model.User) (*mm_model.User, error) {
	user, appErr := a.api.userService.UpdateUser(a.ctx, user, true)
	return user, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) GetUsersFromProfiles(options *mm_model.UserGetOptions) ([]*mm_model.User, error) {
	user, appErr := a.api.userService.GetUsersFromProfiles(options)
	return user, normalizeAppErr(appErr)
}

//
// Team service.
//

func (a *serviceAPIAdapter) GetTeamMember(teamID string, userID string) (*mm_model.TeamMember, error) {
	member, appErr := a.api.teamService.GetMember(teamID, userID)
	return member, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) CreateMember(teamID string, userID string) (*mm_model.TeamMember, error) {
	member, appErr := a.api.teamService.CreateMember(a.ctx, teamID, userID)
	return member, normalizeAppErr(appErr)
}

//
// Permissions service.
//

func (a *serviceAPIAdapter) HasPermissionTo(userID string, permission *mm_model.Permission) bool {
	return a.api.permissionsService.HasPermissionTo(userID, permission)
}

func (a *serviceAPIAdapter) HasPermissionToTeam(userID, teamID string, permission *mm_model.Permission) bool {
	return a.api.permissionsService.HasPermissionToTeam(userID, teamID, permission)
}

func (a *serviceAPIAdapter) HasPermissionToChannel(askingUserID string, channelID string, permission *mm_model.Permission) bool {
	return a.api.permissionsService.HasPermissionToChannel(askingUserID, channelID, permission)
}

//
// Bot service.
//

func (a *serviceAPIAdapter) EnsureBot(bot *mm_model.Bot) (string, error) {
	return a.api.botService.EnsureBot(a.ctx, boardsProductID, bot)
}

//
// License service.
//

func (a *serviceAPIAdapter) GetLicense() *mm_model.License {
	return a.api.licenseService.GetLicense()
}

//
// FileInfoStore service.
//

func (a *serviceAPIAdapter) GetFileInfo(fileID string) (*mm_model.FileInfo, error) {
	fi, appErr := a.api.fileInfoStoreService.GetFileInfo(fileID)
	return fi, normalizeAppErr(appErr)
}

//
// Cluster store.
//

func (a *serviceAPIAdapter) PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *mm_model.WebsocketBroadcast) {
	a.api.clusterService.PublishWebSocketEvent(boardsProductName, event, payload, broadcast)
}

func (a *serviceAPIAdapter) PublishPluginClusterEvent(ev mm_model.PluginClusterEvent, opts mm_model.PluginClusterEventSendOptions) error {
	return a.api.clusterService.PublishPluginClusterEvent(boardsProductName, ev, opts)
}

//
// Cloud service.
//

func (a *serviceAPIAdapter) GetCloudLimits() (*mm_model.ProductLimits, error) {
	return a.api.cloudService.GetCloudLimits()
}

//
// Config service.
//

func (a *serviceAPIAdapter) GetConfig() *mm_model.Config {
	return a.api.configService.Config()
}

//
// Logger service.
//

func (a *serviceAPIAdapter) GetLogger() mlog.LoggerIFace {
	return a.api.logger
}

//
// KVStore service.
//

func (a *serviceAPIAdapter) KVSetWithOptions(key string, value []byte, options mm_model.PluginKVSetOptions) (bool, error) {
	b, appErr := a.api.kvStoreService.SetPluginKeyWithOptions(boardsProductName, key, value, options)
	return b, normalizeAppErr(appErr)
}

//
// Store service.
//

func (a *serviceAPIAdapter) GetMasterDB() (*sql.DB, error) {
	return a.api.storeService.GetMasterDB(), nil
}

//
// System service.
//

func (a *serviceAPIAdapter) GetDiagnosticID() string {
	return a.api.systemService.GetDiagnosticId()
}

//
// Router service.
//

func (a *serviceAPIAdapter) RegisterRouter(sub *mux.Router) {
	a.api.routerService.RegisterRouter(boardsProductName, sub)
}

//
// Preferences service.
//

func (a *serviceAPIAdapter) GetPreferencesForUser(userID string) (mm_model.Preferences, error) {
	p, appErr := a.api.preferencesService.GetPreferencesForUser(userID)
	return p, normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) UpdatePreferencesForUser(userID string, preferences mm_model.Preferences) error {
	appErr := a.api.preferencesService.UpdatePreferencesForUser(userID, preferences)
	return normalizeAppErr(appErr)
}

func (a *serviceAPIAdapter) DeletePreferencesForUser(userID string, preferences mm_model.Preferences) error {
	appErr := a.api.preferencesService.DeletePreferencesForUser(userID, preferences)
	return normalizeAppErr(appErr)
}

// Ensure the adapter implements ServicesAPI.
var _ model.ServicesAPI = &serviceAPIAdapter{}
