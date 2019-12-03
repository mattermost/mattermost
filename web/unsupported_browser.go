// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"

	"github.com/avct/uasurfer"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/utils"
)

// MattermostApp describes downloads for the Mattermost App
type MattermostApp struct {
	LogoSrc                string
	Title                  string
	SupportedVersionString string
	Label                  string
	Link                   string
	InstallGuide           string
	InstallGuideLink       string
}

// Browser describes a browser with a download link
type Browser struct {
	LogoSrc                string
	Title                  string
	SupportedVersionString string
	Src                    string
	GetLatestString        string
}

// SystemBrowser describes a browser but includes 2 links: one to open the local browser, and one to make it default
type SystemBrowser struct {
	LogoSrc                string
	Title                  string
	SupportedVersionString string
	LabelOpen              string
	LinkOpen               string
	LinkMakeDefault        string
	OrString               string
	MakeDefaultString      string
}

func renderUnsupportedBrowser(app *app.App, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	page := utils.NewHTMLTemplate(app.HTMLTemplates(), "unsupported_browser")

	// User Agent info
	ua := uasurfer.Parse(r.UserAgent())
	isWindows := ua.OS.Platform.String() == "PlatformWindows"
	isWindows10 := isWindows && ua.OS.Version.Major == 10
	isMacOSX := ua.OS.Name.String() == "OSMacOSX" && ua.OS.Version.Major == 10
	isSafari := ua.Browser.Name.String() == "BrowserSafari"

	// Basic heading translations
	if isSafari {
		page.Props["NoLongerSupportString"] = app.T("web.error.unsupported_browser.no_longer_support_version")
	} else {
		page.Props["NoLongerSupportString"] = app.T("web.error.unsupported_browser.no_longer_support")
	}
	page.Props["DownloadAppOrUpgradeBrowserString"] = app.T("web.error.unsupported_browser.download_app_or_upgrade_browser")
	page.Props["LearnMoreString"] = app.T("web.error.unsupported_browser.learn_more")

	// Mattermost app version
	if isWindows {
		page.Props["App"] = renderMattermostAppWindows(app)
	} else if isMacOSX {
		page.Props["App"] = renderMattermostAppMac(app)
	}

	// Browsers to download
	// Show a link to Safari if you're using safari and it's outdated
	// Can't show on Mac all the time because there's no way to open it via URI
	browsers := []Browser{renderBrowserChrome(app), renderBrowserFirefox(app)}
	if isSafari {
		browsers = append(browsers, renderBrowserSafari(app))
	}
	page.Props["Browsers"] = browsers

	// If on Windows 10, show link to Edge
	if isWindows10 {
		page.Props["SystemBrowser"] = renderSystemBrowserEdge(app, r)
	}

	page.RenderToWriter(w)
}

func renderMattermostAppMac(app *app.App) MattermostApp {
	return MattermostApp{
		"/static/images/browser-icons/mac.png",
		app.T("web.error.unsupported_browser.download_the_app"),
		app.T("web.error.unsupported_browser.min_os_version.mac"),
		app.T("web.error.unsupported_browser.download"),
		"https://mattermost.com/download/#mattermostApps",
		app.T("web.error.unsupported_browser.install_guide.mac"),
		"https://docs.mattermost.com/install/desktop.html#mac-os-x-10-9",
	}
}

func renderMattermostAppWindows(app *app.App) MattermostApp {
	return MattermostApp{
		"/static/images/browser-icons/windows.svg",
		app.T("web.error.unsupported_browser.download_the_app"),
		app.T("web.error.unsupported_browser.min_os_version.windows"),
		app.T("web.error.unsupported_browser.download"),
		"https://mattermost.com/download/#mattermostApps",
		app.T("web.error.unsupported_browser.install_guide.windows"),
		"https://docs.mattermost.com/install/desktop.html#windows-10-windows-8-1-windows-7",
	}
}

func renderBrowserChrome(app *app.App) Browser {
	return Browser{
		"/static/images/browser-icons/chrome.svg",
		app.T("web.error.unsupported_browser.browser_title.chrome"),
		app.T("web.error.unsupported_browser.min_browser_version.chrome"),
		"http://www.google.com/chrome",
		app.T("web.error.unsupported_browser.browser_get_latest.chrome"),
	}
}

func renderBrowserFirefox(app *app.App) Browser {
	return Browser{
		"/static/images/browser-icons/firefox.svg",
		app.T("web.error.unsupported_browser.browser_title.firefox"),
		app.T("web.error.unsupported_browser.min_browser_version.firefox"),
		"https://www.mozilla.org/firefox/new/",
		app.T("web.error.unsupported_browser.browser_get_latest.firefox"),
	}
}

func renderBrowserSafari(app *app.App) Browser {
	return Browser{
		"/static/images/browser-icons/safari.svg",
		app.T("web.error.unsupported_browser.browser_title.safari"),
		app.T("web.error.unsupported_browser.min_browser_version.safari"),
		"macappstore://showUpdatesPage",
		app.T("web.error.unsupported_browser.browser_get_latest.safari"),
	}
}

func renderSystemBrowserEdge(app *app.App, r *http.Request) SystemBrowser {
	return SystemBrowser{
		"/static/images/browser-icons/edge.svg",
		app.T("web.error.unsupported_browser.browser_title.edge"),
		app.T("web.error.unsupported_browser.min_browser_version.edge"),
		app.T("web.error.unsupported_browser.open_system_browser.edge"),
		"microsoft-edge:http://" + r.Host + r.RequestURI, //TODO: Can we get HTTP or HTTPS? If someone's server doesn't have a redirect this won't work
		"ms-settings:defaultapps",
		app.T("web.error.unsupported_browser.system_browser_or"),
		app.T("web.error.unsupported_browser.system_browser_make_default"),
	}
}
