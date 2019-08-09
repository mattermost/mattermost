package web

import (
	"net/http"

	"github.com/avct/uasurfer"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/utils"
)

// MattermostApp describes downloads for the Mattermost App
type MattermostApp struct {
	LogoSrc                string
	Title                  string
	SupportedVersionString string
	Label64Bit             string
	Link64Bit              string
	Label32Bit             string
	Link32Bit              string
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

func renderUnsuppportedBrowser(app *app.App, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	page := utils.NewHTMLTemplate(app.HTMLTemplates(), "unsupported_browser")

	ua := uasurfer.Parse(r.UserAgent())
	isWindows := ua.OS.Platform.String() == "PlatformWindows"
	isWindows10 := isWindows && ua.OS.Version.Major == 10
	isMacOSX := ua.OS.Name.String() == "OSMacOSX" && ua.OS.Version.Major == 10 && ua.OS.Version.Minor >= 9

	if ua.Browser.Name.String() == "BrowserSafari" {
		page.Props["NoLongerSupportString"] = app.T("web.error.unsupported_browser.no_longer_support_version")
	} else {
		page.Props["NoLongerSupportString"] = app.T("web.error.unsupported_browser.no_longer_support")
	}
	page.Props["DownloadAppOrUpgradeBrowserString"] = app.T("web.error.unsupported_browser.download_app_or_upgrade_browser")
	page.Props["LearnMoreString"] = app.T("web.error.unsupported_browser.learn_more")

	if isWindows {
		page.Props["App"] = renderMattermostAppWindows(app)
	} else if isMacOSX {
		page.Props["App"] = renderMattermostAppMac(app)
	}

	page.Props["Browsers"] = []Browser{renderBrowserChrome(app), renderBrowserFirefox(app)}
	if isWindows10 {
		page.Props["SystemBrowser"] = renderSystemBrowserEdge(app)
	} else if isMacOSX {
		page.Props["SystemBrowser"] = renderSystemBrowserSafari(app)
	}

	page.RenderToWriter(w)
}

func renderMattermostAppMac(app *app.App) MattermostApp {
	return MattermostApp{
		"/static/images/browser-icons/mac.png",
		app.T("web.error.unsupported_browser.download_the_app"),
		app.T("web.error.unsupported_browser.min_os_version.mac"),
		app.T("web.error.unsupported_browser.download_64.mac"),
		"http://www.mattermost.com", //TODO
		"",                          // No 32-bit Mac version
		"",
		app.T("web.error.unsupported_browser.install_guide.mac"),
		"http://www.mattermost.com", //TODO
	}
}

func renderMattermostAppWindows(app *app.App) MattermostApp {
	return MattermostApp{
		"/static/images/browser-icons/windows.png",
		app.T("web.error.unsupported_browser.download_the_app"),
		app.T("web.error.unsupported_browser.min_os_version.windows"),
		app.T("web.error.unsupported_browser.download_64.windows"),
		"http://www.mattermost.com", //TODO
		app.T("web.error.unsupported_browser.download_32.windows"),
		"http://www.mattermost.com", //TODO
		app.T("web.error.unsupported_browser.install_guide.windows"),
		"http://www.mattermost.com", //TODO
	}
}

func renderBrowserChrome(app *app.App) Browser {
	return Browser{
		"/static/images/browser-icons/chrome.png",
		app.T("web.error.unsupported_browser.browser_title.chrome"),
		app.T("web.error.unsupported_browser.min_browser_version.chrome"),
		"http://www.google.com/chrome",
		app.T("web.error.unsupported_browser.browser_get_latest.chrome"),
	}
}

func renderBrowserFirefox(app *app.App) Browser {
	return Browser{
		"/static/images/browser-icons/firefox.png",
		app.T("web.error.unsupported_browser.browser_title.firefox"),
		app.T("web.error.unsupported_browser.min_browser_version.firefox"),
		"http://www.google.com/chrome", //TODO
		app.T("web.error.unsupported_browser.browser_get_latest.firefox"),
	}
}

func renderSystemBrowserSafari(app *app.App) SystemBrowser {
	return SystemBrowser{
		"/static/images/browser-icons/safari.png",
		app.T("web.error.unsupported_browser.browser_title.safari"),
		app.T("web.error.unsupported_browser.min_browser_version.safari"),
		app.T("web.error.unsupported_browser.open_system_browser.safari"),
		"http://www.google.com/chrome", //TODO
		"http://www.google.com/chrome", //TODO
		app.T("web.error.unsupported_browser.system_browser_or"),
		app.T("web.error.unsupported_browser.system_browser_make_default"),
	}
}

func renderSystemBrowserEdge(app *app.App) SystemBrowser {
	return SystemBrowser{
		"/static/images/browser-icons/edge.png",
		app.T("web.error.unsupported_browser.browser_title.edge"),
		app.T("web.error.unsupported_browser.min_browser_version.edge"),
		app.T("web.error.unsupported_browser.open_system_browser.edge"),
		"http://www.google.com/chrome", //TODO
		"http://www.google.com/chrome", //TODO
		app.T("web.error.unsupported_browser.system_browser_or"),
		app.T("web.error.unsupported_browser.system_browser_make_default"),
	}
}
