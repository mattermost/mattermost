// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
)

// WithMaster adds the context value that master DB should be selected for this request.
func WithMaster(ctx context.Context) context.Context {
	return sqlstore.WithMaster(ctx)
}

func pluginContext(c request.CTX) *plugin.Context {
	context := &plugin.Context{
		RequestId:      c.RequestId(),
		SessionId:      c.Session().Id,
		IPAddress:      c.IPAddress(),
		AcceptLanguage: c.AcceptLanguage(),
		UserAgent:      c.UserAgent(),
	}
	return context
}
