// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost-server/v6/model"

func (a *App) SubscribeWebsocketScopes(connectionID string, scopes []string) *model.AppError {
	// Using a websocket event for this is a total hack, but it lets us use Publish's support for broadcasting across
	// the cluster
	message := model.NewWebSocketEvent("subscribe", "", "", "", nil).SetBroadcast(&model.WebsocketBroadcast{
		ConnectionId: connectionID,
	})

	message.Add("scopes", scopes)

	a.Publish(message)

	return nil
}

func (a *App) UnsubscribeWebsocketScopes(connectionID string, scopes []string) *model.AppError {
	// Using a websocket event for this is a total hack, but it lets us use Publish's support for broadcasting across
	// the cluster
	message := model.NewWebSocketEvent("unsubscribe", "", "", "", nil).SetBroadcast(&model.WebsocketBroadcast{
		ConnectionId: connectionID,
	})

	message.Add("scopes", scopes)

	a.Publish(message)

	return nil
}
