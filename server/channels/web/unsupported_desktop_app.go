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
	props := openSansFontProps(subpath)

	props["Title"] = rctx.T("web.error.unsupported_desktop_app.title")
	props["MessageString"] = rctx.T("web.error.unsupported_desktop_app.message", map[string]any{
		"SiteName":       *cfg.TeamSettings.SiteName,
		"CurrentVersion": currentVersion,
		"MinimumVersion": *cfg.ServiceSettings.MinimumDesktopAppVersion,
	})
	props["DownloadButtonLabel"] = rctx.T("web.error.unsupported_desktop_app.download_button")
	props["AssistanceString"] = rctx.T("web.error.unsupported_desktop_app.assistance")
	props["FooterAboutLabel"] = rctx.T("web.error.unsupported_desktop_app.footer_about")
	props["FooterPrivacyLabel"] = rctx.T("web.error.unsupported_desktop_app.footer_privacy")
	props["FooterTermsLabel"] = rctx.T("web.error.unsupported_desktop_app.footer_terms")
	props["FooterHelpLabel"] = rctx.T("web.error.unsupported_desktop_app.footer_help")

	props["CurrentDesktopAppVersion"] = currentVersion
	props["MinimumDesktopAppVersion"] = *cfg.ServiceSettings.MinimumDesktopAppVersion
	props["DownloadLink"] = *cfg.NativeAppSettings.AppDownloadLink
	props["BackgroundImageURL"] = staticImageURL(subpath, "admin-onboarding-background.jpg")
	props["LogoURL"] = staticImageURL(subpath, "logo.svg")
	props["AlertIconURL"] = staticImageURL(subpath, "alert.svg")
	props["MetropolisFontURL"] = staticAssetURL(subpath, "fonts", "Metropolis-SemiBold.woff")
	props["CopyrightYear"] = time.Now().Year()
	props["SiteName"] = *cfg.TeamSettings.SiteName
	props["AboutLink"] = *cfg.SupportSettings.AboutLink
	props["PrivacyPolicyLink"] = *cfg.SupportSettings.PrivacyPolicyLink
	props["TermsOfServiceLink"] = *cfg.SupportSettings.TermsOfServiceLink
	props["HelpLink"] = *cfg.SupportSettings.HelpLink

	return templates.Data{Props: props}
}

func staticImageURL(subpath, filename string) string {
	return staticAssetURL(subpath, "images", filename)
}
