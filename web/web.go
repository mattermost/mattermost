// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"strings"

	"xojoc.pw/useragent"

	"github.com/NYTimes/gziphandler"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func Init(api3 *api.API) {
	l4g.Debug(utils.T("web.init.debug"))

	mainrouter := api3.BaseRoutes.Root

	if *api3.App.Config().ServiceSettings.WebserverMode != "disabled" {
		staticDir, _ := utils.FindDir(model.CLIENT_DIR)
		l4g.Debug("Using client directory at %v", staticDir)

		staticHandler := staticHandler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
		pluginHandler := pluginHandler(api3.App.Config, http.StripPrefix("/static/plugins/", http.FileServer(http.Dir(*api3.App.Config().PluginSettings.ClientDirectory))))

		if *api3.App.Config().ServiceSettings.WebserverMode == "gzip" {
			staticHandler = gziphandler.GzipHandler(staticHandler)
			pluginHandler = gziphandler.GzipHandler(pluginHandler)
		}

		mainrouter.PathPrefix("/static/plugins/").Handler(pluginHandler)
		mainrouter.PathPrefix("/static/").Handler(staticHandler)
		mainrouter.Handle("/{anything:.*}", api3.AppHandlerIndependent(root)).Methods("GET")
	}
}

func staticHandler(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "max-age=31556926, public")
		if strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}
		handler.ServeHTTP(w, r)
	})
}

func pluginHandler(config model.ConfigFunc, handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if *config().ServiceSettings.EnableDeveloper {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		} else {
			w.Header().Set("Cache-Control", "max-age=31556926, public")
		}
		if strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}
		handler.ServeHTTP(w, r)
	})
}

// Older Versions of Chrome, FF, and Edge and other lesser known browsers may also have bugs.
// Due to the complexities of UA detection and teh eamifications of a misdetection only these older browsers throw incopatability errors.

// Map should be of minimum required browser version.
var browserMinimumSupported = map[string]int{
	"MSIE":   11,
	"Safari": 9,
}

func CheckClientCompatability(agentString string) bool {
	ua := useragent.Parse(agentString)

	l4g.Debug("User Agent: %v", agentString)
	l4g.Debug("Detected Client: %v %v", ua.Name, ua.Version)

	if version, exist := browserMinimumSupported[ua.Name]; exist && int(ua.Version.Major) < version {
		l4g.Debug("Client not supported.")
		return false
	}

	l4g.Debug("Client not version controlled.")
	return true
}

func root(c *api.Context, w http.ResponseWriter, r *http.Request) {

	if !CheckClientCompatability(r.UserAgent()) {
		w.Header().Set("Cache-Control", "no-store")
		page := utils.NewHTMLTemplate(c.App.HTMLTemplates(), "unsupported_browser")
		page.Props["Title"] = c.T("web.error.unsupported_browser.title")
		page.Props["Message"] = c.T("web.error.unsupported_browser.message")
		page.RenderToWriter(w)
		return
	}

	if api.IsApiCall(r) {
		api.Handle404(w, r)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")

	staticDir, _ := utils.FindDir(model.CLIENT_DIR)
	http.ServeFile(w, r, staticDir+"root.html")
}
