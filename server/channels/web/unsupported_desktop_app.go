// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

func renderUnsupportedDesktopApp(rctx request.CTX, cfg *model.Config, currentVersion, subpath string) templates.Data {
	return templates.Data{
		Props: map[string]any{
			"Subpath": ensureTrailingSlash(subpath),
			"Title":   rctx.T("web.error.unsupported_desktop_app.title"),
			"MessageString": rctx.T("web.error.unsupported_desktop_app.message", map[string]any{
				"SiteName":       *cfg.TeamSettings.SiteName,
				"CurrentVersion": currentVersion,
				"MinimumVersion": *cfg.ServiceSettings.MinimumDesktopAppVersion,
			}),
			"DownloadButtonLabel": rctx.T("web.error.unsupported_desktop_app.download_button"),
			"AssistanceString":    rctx.T("web.error.unsupported_desktop_app.assistance"),
			"FooterAboutLabel":    rctx.T("web.error.unsupported_desktop_app.footer_about"),
			"FooterPrivacyLabel":  rctx.T("web.error.unsupported_desktop_app.footer_privacy"),
			"FooterTermsLabel":    rctx.T("web.error.unsupported_desktop_app.footer_terms"),
			"FooterHelpLabel":     rctx.T("web.error.unsupported_desktop_app.footer_help"),
			"DownloadLink":        *cfg.NativeAppSettings.AppDownloadLink,
			"CopyrightYear":       time.Now().Year(),
			"SiteName":            *cfg.TeamSettings.SiteName,
			"AboutLink":           *cfg.SupportSettings.AboutLink,
			"PrivacyPolicyLink":   *cfg.SupportSettings.PrivacyPolicyLink,
			"TermsOfServiceLink":  *cfg.SupportSettings.TermsOfServiceLink,
			"HelpLink":            *cfg.SupportSettings.HelpLink,
		},
	}
}
