// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/plugin"
)

func (a *App) PluginContext(c *Context) *plugin.Context {
	context := &plugin.Context{
		RequestId:      c.RequestId(),
		SessionId:      c.Session().Id,
		IpAddress:      c.IpAddress(),
		AcceptLanguage: c.AcceptLanguage(),
		UserAgent:      c.UserAgent(),
	}
	return context
}
