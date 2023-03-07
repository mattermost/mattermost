// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/server/v8/model"
)

func (a *App) NotifySelfHostedSignupProgress(progress string, userId string) {
	// this is an event only the relevant admin should receive.
	// If there is no progress, there is nothing to report.
	// If there is no userId, we do not want to mistakenly broadcast to all users.
	if progress == "" || userId == "" {
		return
	}
	message := model.NewWebSocketEvent(model.WebsocketEventHostedCustomerSignupProgressUpdated, "", "", userId, nil, "")
	message.Add("progress", progress)

	a.Srv().Platform().Publish(message)
}
