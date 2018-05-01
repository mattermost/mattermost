// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/NYTimes/gziphandler"
	"github.com/avct/uasurfer"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func Init(api3 *api.API) {
	mlog.Debug("Initializing web routes")

	mainrouter := api3.BaseRoutes.Root

	if *api3.App.Config().ServiceSettings.WebserverMode != "disabled" {
		staticDir, _ := utils.FindDir(model.CLIENT_DIR)
		mlog.Debug(fmt.Sprintf("Using client directory at %v", staticDir))

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

// Due to the complexities of UA detection and the ramifications of a misdetection only older Safari and IE browsers throw incompatibility errors.

// Map should be of minimum required browser version.
var browserMinimumSupported = map[string]int{
	"BrowserIE":     11,
	"BrowserSafari": 9,
}

func CheckClientCompatability(agentString string) bool {
	ua := uasurfer.Parse(agentString)

	if version, exist := browserMinimumSupported[ua.Browser.Name.String()]; exist && ua.Browser.Version.Major < version {
		return false
	}

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
		api.Handle404(c.App, w, r)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")

	staticDir, _ := utils.FindDir(model.CLIENT_DIR)
	http.ServeFile(w, r, filepath.Join(staticDir, "root.html"))
}
