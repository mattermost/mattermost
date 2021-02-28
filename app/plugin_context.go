// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/plugin"
)

func (a *App) PluginContext() *plugin.Context {
	context := &plugin.Context{
		RequestID:      a.RequestId(),
		SessionID:      a.Session().Id,
		IPAddress:      a.IpAddress(),
		AcceptLanguage: a.AcceptLanguage(),
		UserAgent:      a.UserAgent(),
	}
	return context
}
