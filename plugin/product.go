// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"errors"
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

// ProductHooks is a subset of Hooks
type ProductHooks interface {
	OnConfigurationChange() error
	MessageWillBePosted(ctx *Context, post *model.Post) (*model.Post, string)
	MessageWillBeUpdated(ctx *Context, newPost, oldPost *model.Post) (*model.Post, string)
	OnPluginClusterEvent(ctx *Context, ev model.PluginClusterEvent)
	OnWebSocketDisconnect(webConnID, userID string)
	OnWebSocketConnect(webConnID, userID string)
	WebSocketMessageHasBeenPosted(webConnID, userID string, req *model.WebSocketRequest)
}

type registeredProduct struct {
	productID   string
	implemented map[int]struct{}
	adapter     Hooks
}

func (rp *registeredProduct) Implements(hookId int) bool {
	_, ok := rp.implemented[hookId]
	return ok
}

type hooksAdapter struct {
	productHooks ProductHooks
}

func newRegisteredProduct(pluginID string, productHooks ProductHooks) *registeredProduct {
	return &registeredProduct{
		productID: pluginID,
		implemented: map[int]struct{}{
			OnConfigurationChangeID:         {},
			MessageWillBePostedID:           {},
			MessageWillBeUpdatedID:          {},
			OnPluginClusterEventID:          {},
			OnWebSocketConnectID:            {},
			OnWebSocketDisconnectID:         {},
			WebSocketMessageHasBeenPostedID: {},
		},
		adapter: &hooksAdapter{
			productHooks: productHooks,
		},
	}
}

func (a *hooksAdapter) OnActivate() error {
	return errors.New("not implemented")
}

func (a *hooksAdapter) Implemented() ([]string, error) {
	return nil, errors.New("not implemented")
}

func (a *hooksAdapter) OnDeactivate() error {
	return errors.New("not implemented")
}

func (a *hooksAdapter) OnConfigurationChange() error {
	return a.productHooks.OnConfigurationChange()
}

func (a *hooksAdapter) ServeHTTP(c *Context, w http.ResponseWriter, r *http.Request) {}

func (a *hooksAdapter) ExecuteCommand(c *Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	return nil, model.NewAppError("ExecuteCommand", "api.command.execute_command.start.app_error", nil, "not implemented", http.StatusNotImplemented)
}

func (a *hooksAdapter) UserHasBeenCreated(c *Context, user *model.User) {}

func (a *hooksAdapter) UserWillLogIn(c *Context, user *model.User) string {
	return ""
}

func (a *hooksAdapter) UserHasLoggedIn(c *Context, user *model.User) {}

func (a *hooksAdapter) MessageWillBePosted(c *Context, post *model.Post) (*model.Post, string) {
	return a.productHooks.MessageWillBePosted(c, post)
}

func (a *hooksAdapter) MessageWillBeUpdated(c *Context, newPost, oldPost *model.Post) (*model.Post, string) {
	return a.productHooks.MessageWillBeUpdated(c, newPost, oldPost)
}

func (a *hooksAdapter) MessageHasBeenPosted(c *Context, post *model.Post) {}

func (a *hooksAdapter) MessageHasBeenUpdated(c *Context, newPost, oldPost *model.Post) {}

func (a *hooksAdapter) ChannelHasBeenCreated(c *Context, channel *model.Channel) {}

func (a *hooksAdapter) UserHasJoinedChannel(c *Context, channelMember *model.ChannelMember, actor *model.User) {
}

func (a *hooksAdapter) UserHasLeftChannel(c *Context, channelMember *model.ChannelMember, actor *model.User) {
}

func (a *hooksAdapter) UserHasJoinedTeam(c *Context, teamMember *model.TeamMember, actor *model.User) {
}

func (a *hooksAdapter) UserHasLeftTeam(c *Context, teamMember *model.TeamMember, actor *model.User) {}

func (a *hooksAdapter) FileWillBeUploaded(c *Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
	return nil, ""
}

func (a *hooksAdapter) ReactionHasBeenAdded(c *Context, reaction *model.Reaction) {}

func (a *hooksAdapter) ReactionHasBeenRemoved(c *Context, reaction *model.Reaction) {}

func (a *hooksAdapter) OnPluginClusterEvent(c *Context, ev model.PluginClusterEvent) {
	a.productHooks.OnPluginClusterEvent(c, ev)
}

func (a *hooksAdapter) OnWebSocketConnect(webConnID, userID string) {
	a.productHooks.OnWebSocketConnect(webConnID, userID)
}

func (a *hooksAdapter) OnWebSocketDisconnect(webConnID, userID string) {
	a.productHooks.OnWebSocketDisconnect(webConnID, userID)
}

func (a *hooksAdapter) WebSocketMessageHasBeenPosted(webConnID, userID string, req *model.WebSocketRequest) {
	a.productHooks.WebSocketMessageHasBeenPosted(webConnID, userID, req)
}

func (a *hooksAdapter) RunDataRetention(nowTime, batchSize int64) (int64, error) {
	return -1, errors.New("not implemented")
}

func (a *hooksAdapter) OnInstall(c *Context, event model.OnInstallEvent) error {
	return errors.New("not implemented")
}

func (a *hooksAdapter) OnSendDailyTelemetry() {}

func (a *hooksAdapter) OnCloudLimitsUpdated(limits *model.ProductLimits) {}
