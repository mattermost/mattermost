// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/NYTimes/gziphandler"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
)

func InitWeb() {
	l4g.Debug(utils.T("web.init.debug"))

	mainrouter := app.Srv.Router

	if *utils.Cfg.ServiceSettings.WebserverMode != "disabled" {
		staticDir, _ := utils.FindDir(model.CLIENT_DIR)
		l4g.Debug("Using client directory at %v", staticDir)
		if *utils.Cfg.ServiceSettings.WebserverMode == "gzip" {
			mainrouter.PathPrefix("/static/").Handler(gziphandler.GzipHandler(staticHandler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))))
		} else {
			mainrouter.PathPrefix("/static/").Handler(staticHandler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir)))))
		}

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

//List should be of minimum required browser version. Do not place a ; at the end of this string.
var browsersNotSupported string = "MSIE/11;Internet Explorer/11;Safari/9;Chrome/43;Edge/38;Firefox/52"

func CheckBrowserCompatability(c *api.Context, r *http.Request) bool {
	ua := user_agent.New(r.UserAgent())
	bname, bversion := ua.Browser()

	browsers := strings.Split(browsersNotSupported, ";")
	for _, browser := range browsers {
		version := strings.Split(browser, "/")
		curVersion := strings.Split(bversion, ".")
		intCurVersion, _ := strconv.Atoi(curVersion[0])
		intVersion, _ := strconv.Atoi(version[1])

		if strings.HasPrefix(bname, version[0]) && (intCurVersion < intVersion) {
			return false
		}
	}

	return true

}

func root(c *api.Context, w http.ResponseWriter, r *http.Request) {
	errorURL := "/error?type=unsupported_browser"
	if r.URL.RequestURI() != errorURL {
		if !CheckBrowserCompatability(c, r) {
			w.Header().Set("Cache-Control", "no-store")
			http.Redirect(w, r, errorURL, http.StatusTemporaryRedirect)
			return
		}
	}

	if api.IsApiCall(r) {
		api.Handle404(w, r)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")

	staticDir, _ := utils.FindDir(model.CLIENT_DIR)
	http.ServeFile(w, r, staticDir+"root.html")
}
