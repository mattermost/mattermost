// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/avct/uasurfer"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

var requestProvidedSessionAttributeFieldNames = []string{
	model.SessionAttributesPropertyFieldUserAgentPlatform,
	model.SessionAttributesPropertyFieldUserAgentOS,
	model.SessionAttributesPropertyFieldUserAgentBrowserName,
	model.SessionAttributesPropertyFieldUserAgentBrowserVersion,
	model.SessionAttributesPropertyFieldIPAddress,
}

func (a *App) RefreshRequestProvidedSessionAttributesIfNeeded(rctx request.CTX, r *http.Request) {
	if !a.Config().FeatureFlags.SessionAttributes {
		return
	}

	if l := a.License(); !model.MinimumEnterpriseAdvancedLicense(l) {
		return
	}

	session := rctx.Session()
	if session == nil || session.Id == "" || session.UserId == "" || r == nil {
		return
	}
	if session.Local {
		return
	}
	switch session.Props[model.SessionPropType] {
	case model.SessionTypeUserAccessToken, model.SessionTypeCloudKey, model.SessionTypeRemoteclusterToken:
		return
	}

	attrs := make(map[string]any, len(requestProvidedSessionAttributeFieldNames))
	for _, name := range requestProvidedSessionAttributeFieldNames {
		if v := a.getRequestProvidedSessionAttributeByName(r, name); v != "" {
			attrs[name] = v
		}
	}
	if len(attrs) == 0 {
		return
	}

	if err := a.Srv().Store().SessionAttribute().Refresh(session.Id, attrs); err != nil {
		rctx.Logger().Warn("Failed to refresh session attributes", mlog.Err(err))
	}
}

func (a *App) getRequestProvidedSessionAttributeByName(r *http.Request, name string) string {
	uaStr := r.UserAgent()
	ua := uasurfer.Parse(uaStr)

	switch name {
	case model.SessionAttributesPropertyFieldUserAgentPlatform:
		return getPlatformName(ua, uaStr)
	case model.SessionAttributesPropertyFieldUserAgentOS:
		return getOSName(ua, uaStr)
	case model.SessionAttributesPropertyFieldUserAgentBrowserName:
		return getBrowserName(ua, uaStr)
	case model.SessionAttributesPropertyFieldUserAgentBrowserVersion:
		return getBrowserVersion(ua, uaStr)
	case model.SessionAttributesPropertyFieldIPAddress:
		return utils.GetIPAddress(r, a.Config().ServiceSettings.TrustedProxyIPHeader)
	}

	return ""
}
