// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"strings"

	"github.com/NYTimes/gziphandler"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
)

const (
	CLIENT_DIR = "webapp/dist"
)

func InitWeb() {
	l4g.Debug(utils.T("web.init.debug"))

	mainrouter := api.Srv.Router

	if *utils.Cfg.ServiceSettings.WebserverMode != "disabled" {
		staticDir := utils.FindDir(CLIENT_DIR)
		l4g.Debug("Using client directory at %v", staticDir)
		if *utils.Cfg.ServiceSettings.WebserverMode == "gzip" {
			mainrouter.PathPrefix("/static/").Handler(gziphandler.GzipHandler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir)))))
		} else {
			mainrouter.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
		}

		mainrouter.Handle("/{anything:.*}", api.AppHandlerIndependent(root)).Methods("GET")
	}
}

var browsersNotSupported string = "MSIE/8;MSIE/9;MSIE/10;Internet Explorer/8;Internet Explorer/9;Internet Explorer/10;Safari/7;Safari/8"

func CheckBrowserCompatability(c *api.Context, r *http.Request) bool {
	ua := user_agent.New(r.UserAgent())
	bname, bversion := ua.Browser()

	browsers := strings.Split(browsersNotSupported, ";")
	for _, browser := range browsers {
		version := strings.Split(browser, "/")

		if strings.HasPrefix(bname, version[0]) && strings.HasPrefix(bversion, version[1]) {
			c.Err = model.NewLocAppError("CheckBrowserCompatability", "web.check_browser_compatibility.app_error", nil, "")
			return false
		}
	}

	return true

}

func root(c *api.Context, w http.ResponseWriter, r *http.Request) {
	if !CheckBrowserCompatability(c, r) {
		return
	}

	if api.IsApiCall(r) {
		api.Handle404(w, r)
		return
	}

	http.ServeFile(w, r, utils.FindDir(CLIENT_DIR)+"root.html")
}
