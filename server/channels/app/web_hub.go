// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/app/platform"
)

func (a *App) TotalWebsocketConnections() int {
	return a.Srv().Platform().TotalWebsocketConnections()
}

func (a *App) GetHubForUserId(userID string) *platform.Hub {
	return a.Srv().Platform().GetHubForUserId(userID)
}

// HubRegister registers a connection to a hub.
func (a *App) HubRegister(webConn *platform.WebConn) {
	a.Srv().Platform().HubRegister(webConn)
}

// HubUnregister unregisters a connection from a hub.
func (a *App) HubUnregister(webConn *platform.WebConn) {
	a.Srv().Platform().HubUnregister(webConn)
}

func (a *App) Publish(message *model.WebSocketEvent) {
	a.Srv().Platform().Publish(message)
}

func (ch *Channels) Publish(message *model.WebSocketEvent) {
	ch.srv.Platform().Publish(message)
}

func (a *App) invalidateCacheForChannelMembers(channelID string) {
	a.Srv().Platform().InvalidateCacheForChannelMembers(channelID)
}

func (a *App) invalidateCacheForChannelMembersNotifyProps(channelID string) {
	a.Srv().Platform().InvalidateCacheForChannelMembersNotifyProps(channelID)
}

func (a *App) invalidateCacheForChannelPosts(channelID string) {
	a.Srv().Platform().InvalidateCacheForChannelPosts(channelID)
}

func (a *App) InvalidateCacheForUser(userID string) {
	a.Srv().Platform().InvalidateCacheForUser(userID)
}

func (a *App) invalidateCacheForUserTeams(userID string) {
	a.Srv().Platform().InvalidateCacheForUserTeams(userID)
}

// UpdateWebConnUserActivity sets the LastUserActivityAt of the hub for the given session.
func (a *App) UpdateWebConnUserActivity(session model.Session, activityAt int64) {
	a.Srv().Platform().UpdateWebConnUserActivity(session, activityAt)
}

// SessionIsRegistered determines if a specific session has been registered
func (a *App) SessionIsRegistered(session model.Session) bool {
	return a.Srv().Platform().SessionIsRegistered(session)
}

func (a *App) CheckWebConn(userID, connectionID string) *platform.CheckConnResult {
	return a.Srv().Platform().CheckWebConn(userID, connectionID)
}
