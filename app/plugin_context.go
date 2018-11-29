// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import "github.com/mattermost/mattermost-server/plugin"

func (a *App) PluginContext() *plugin.Context {
	context := &plugin.Context{
		SessionId: a.Session.Id,
	}
	return context
}
