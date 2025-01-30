// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/channels/utils"

	serverContext "context"
	"net/http"
)

// RequestContextWithMaster adds the context value that master DB should be selected for this request.
func RequestContextWithMaster(c request.CTX) request.CTX {
	return sqlstore.RequestContextWithMaster(c)
}

func pluginContext(c request.CTX) *plugin.Context {
	if c == nil {
		return &plugin.Context{}
	}
	return &plugin.Context{
		RequestId:      c.RequestId(),
		SessionId:      c.Session().Id,
		IPAddress:      c.IPAddress(),
		AcceptLanguage: c.AcceptLanguage(),
		UserAgent:      c.UserAgent(),
	}
}

func PluginCTX(r *http.Request, app *App) request.CTX {
	var c request.CTX
	if r == nil || app == nil {
		c = nil
	} else {
		t, _ := i18n.GetTranslationsAndLocaleFromRequest(r)
		c = request.NewContext(
			serverContext.Background(),
			model.NewId(),
			utils.GetIPAddress(r, app.Config().ServiceSettings.TrustedProxyIPHeader),
			r.Header.Get("X-Forwarded-For"),
			r.URL.Path,
			r.UserAgent(),
			r.Header.Get("Accept-Language"),
			t,
		)
	}

	return c
}
