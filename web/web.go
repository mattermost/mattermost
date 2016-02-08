// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
)

func InitWeb() {
	l4g.Debug(utils.T("web.init.debug"))

	mainrouter := api.Srv.Router

	staticDir := utils.FindDir("web/static")
	l4g.Debug("Using static directory at %v", staticDir)
	mainrouter.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	mainrouter.Handle("/{anything:.*}", api.AppHandlerIndependent(root)).Methods("GET")
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

	page := utils.NewHTMLTemplate("root", c.Locale)
	page.Props["Title"] = c.T("web.root.home_title")
	if err := page.RenderToWriter(w); err != nil {
		c.SetUnknownError(page.TemplateName, err.Error())
	}
}
