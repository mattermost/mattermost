// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"strings"

	"github.com/NYTimes/gziphandler"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mssola/user_agent"
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

var browsersNotSupported string = "MSIE/8;MSIE/9;MSIE/10;Internet Explorer/8;Internet Explorer/9;Internet Explorer/10;Safari/7;Safari/8"

func CheckBrowserCompatability(c *api.Context, r *http.Request) bool {
	ua := user_agent.New(r.UserAgent())
	bname, bversion := ua.Browser()

	browsers := strings.Split(browsersNotSupported, ";")
	for _, browser := range browsers {
		version := strings.Split(browser, "/")

		if strings.HasPrefix(bname, version[0]) && strings.HasPrefix(bversion, version[1]) {
			return false
		}
	}

	return true
}

func root(c *api.Context, w http.ResponseWriter, r *http.Request) {
	if !CheckBrowserCompatability(c, r) {
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
