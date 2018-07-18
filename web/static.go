// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"fmt"
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/GeertJohan/go.rice"
	"github.com/NYTimes/gziphandler"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (w *Web) InitStatic() {
	if *w.App.Config().ServiceSettings.WebserverMode != "disabled" {
		utils.UpdateAssetsSubpathFromConfig(w.App.Config())

		subpath, _ := utils.GetSubpathFromConfig(w.App.Config())

		var staticsHandler http.Handler
		fmt.Println(w.App.ClientOverride)
		if w.App.ClientOverride == "" {
			box := GetClientBox()
			staticsHandler = staticHandler(http.StripPrefix(path.Join(subpath, "static"), http.FileServer(box.HTTPBox())))
		} else {
			mlog.Debug(fmt.Sprintf("Using client directory at %v", w.App.ClientOverride))
			staticsHandler = staticHandler(http.StripPrefix(path.Join(subpath, "static"), http.FileServer(http.Dir(w.App.ClientOverride))))
		}
		pluginHandler := pluginHandler(w.App.Config, http.StripPrefix(path.Join(subpath, "static", "plugins"), http.FileServer(http.Dir(*w.App.Config().PluginSettings.ClientDirectory))))

		if *w.App.Config().ServiceSettings.WebserverMode == "gzip" {
			staticsHandler = gziphandler.GzipHandler(staticsHandler)
			pluginHandler = gziphandler.GzipHandler(pluginHandler)
		}

		w.MainRouter.PathPrefix("/static/plugins/").Handler(pluginHandler)
		w.MainRouter.PathPrefix("/static/").Handler(staticsHandler)
		w.MainRouter.Handle("/{anything:.*}", w.NewStaticHandler(root)).Methods("GET")

		// When a subpath is defined, it's necessary to handle redirects without a
		// trailing slash. We don't want to use StrictSlash on the w.MainRouter and affect
		// all routes, just /subpath -> /subpath/.
		w.MainRouter.HandleFunc("", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, r.URL.String()+"/", http.StatusFound)
		}))
	}
}

func root(c *Context, w http.ResponseWriter, r *http.Request) {

	if !CheckClientCompatability(r.UserAgent()) {
		w.Header().Set("Cache-Control", "no-store")
		page := utils.NewHTMLTemplate(c.App.HTMLTemplates(), "unsupported_browser")
		page.Props["Title"] = c.T("web.error.unsupported_browser.title")
		page.Props["Message"] = c.T("web.error.unsupported_browser.message")
		page.RenderToWriter(w)
		return
	}

	if IsApiCall(c.App, r) {
		Handle404(c.App, w, r)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")

	box := GetClientBox()
	if c.App.ClientOverride == "" {
		rootHtml, err := box.Open("root.html")
		if err != nil {
			return
		}
		rootHtmlStat, err := rootHtml.Stat()
		if err != nil {
			return
		}
		http.ServeContent(w, r, "root.html", rootHtmlStat.ModTime(), rootHtml)
	} else {
		http.ServeFile(w, r, filepath.Join(c.App.ClientOverride, "root.html"))
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

func GetClientBox() *rice.Box {
	return rice.MustFindBox("../client/")
}
