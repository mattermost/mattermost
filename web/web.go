// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/NYTimes/gziphandler"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mssola/user_agent"
)

func InitWeb() {
	l4g.Debug(utils.T("web.init.debug"))

	mainrouter := app.Global().Srv.Router

	if *utils.Cfg.ServiceSettings.WebserverMode != "disabled" {
		staticDir, _ := utils.FindDir(model.CLIENT_DIR)
		l4g.Debug("Using client directory at %v", staticDir)

		staticHandler := staticHandler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
		pluginHandler := pluginHandler(http.StripPrefix("/static/plugins/", http.FileServer(http.Dir(staticDir+"plugins/"))))

		if *utils.Cfg.ServiceSettings.WebserverMode == "gzip" {
			staticHandler = gziphandler.GzipHandler(staticHandler)
			pluginHandler = gziphandler.GzipHandler(pluginHandler)
		}

		mainrouter.PathPrefix("/static/plugins/").Handler(pluginHandler)
		mainrouter.PathPrefix("/static/").Handler(staticHandler)
		mainrouter.Handle("/{anything:.*}", api.AppHandlerIndependent(root)).Methods("GET")
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

func pluginHandler(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if *utils.Cfg.ServiceSettings.EnableDeveloper {
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

//map should be of minimum required browser version.
//var browsersNotSupported string = "MSIE/11;Internet Explorer/11;Safari/9;Chrome/43;Edge/15;Firefox/52"
//var browserMinimumSupported = [6]string{"MSIE/11", "Internet Explorer/11", "Safari/9", "Chrome/43", "Edge/15", "Firefox/52"}
var browserMinimumSupported = map[string]int{
	"MSIE":              11,
	"Internet Explorer": 11,
	"Safari":            9,
	"Chrome":            43,
	"Edge":              15,
	"Firefox":           52,
}

func CheckBrowserCompatability(ua *user_agent.UserAgent) bool {
	bname, bversion := ua.Browser()

	l4g.Debug("Detected Browser: %v %v", bname, bversion)

	curVersion := strings.Split(bversion, ".")
	intCurVersion, _ := strconv.Atoi(curVersion[0])

	if version, exist := browserMinimumSupported[bname]; exist && intCurVersion < version {
		return false
	}

	return true

}

func root(c *api.Context, w http.ResponseWriter, r *http.Request) {
	if !CheckBrowserCompatability(user_agent.New(r.UserAgent())) {
		w.Header().Set("Cache-Control", "no-store")
		page := utils.NewHTMLTemplate("unsupported_browser", c.Locale)
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
