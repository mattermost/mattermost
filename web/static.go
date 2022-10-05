// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"fmt"
	"html"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/mattermost/gziphandler"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/shared/templates"
	"github.com/mattermost/mattermost-server/v6/utils"
	"github.com/mattermost/mattermost-server/v6/utils/fileutils"
)

var robotsTxt = []byte("User-agent: *\nDisallow: /\n")

func (w *Web) InitStatic() {
	if *w.srv.Config().ServiceSettings.WebserverMode != "disabled" {
		if err := utils.UpdateAssetsSubpathFromConfig(w.srv.Config()); err != nil {
			mlog.Error("Failed to update assets subpath from config", mlog.Err(err))
		}

		staticDir, _ := fileutils.FindDir(model.ClientDir)
		mlog.Debug("Using client directory", mlog.String("clientDir", staticDir))

		subpath, _ := utils.GetSubpathFromConfig(w.srv.Config())

		staticHandler := staticFilesHandler(http.StripPrefix(path.Join(subpath, "static"), http.FileServer(http.Dir(staticDir))))
		pluginHandler := staticFilesHandler(http.StripPrefix(path.Join(subpath, "static", "plugins"), http.FileServer(http.Dir(*w.srv.Config().PluginSettings.ClientDirectory))))

		if *w.srv.Config().ServiceSettings.WebserverMode == "gzip" {
			staticHandler = gziphandler.GzipHandler(staticHandler)
			pluginHandler = gziphandler.GzipHandler(pluginHandler)
		}

		w.MainRouter.PathPrefix("/static/plugins/").Handler(pluginHandler)
		w.MainRouter.PathPrefix("/static/").Handler(staticHandler)
		w.MainRouter.Handle("/robots.txt", http.HandlerFunc(robotsHandler))
		w.MainRouter.Handle("/unsupported_browser.js", http.HandlerFunc(unsupportedBrowserScriptHandler))
		w.MainRouter.Handle("/{anything:.*}", w.NewStaticHandler(root)).Methods("GET")

		// When a subpath is defined, it's necessary to handle redirects without a
		// trailing slash. We don't want to use StrictSlash on the w.MainRouter and affect
		// all routes, just /subpath -> /subpath/.
		w.MainRouter.HandleFunc("", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path += "/"
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		}))
	}
}

func root(c *Context, w http.ResponseWriter, r *http.Request) {

	if !CheckClientCompatibility(r.UserAgent()) {
		w.Header().Set("Cache-Control", "no-store")
		data := renderUnsupportedBrowser(c.AppContext, r)

		c.App.Srv().TemplatesContainer().Render(w, "unsupported_browser", data)
		return
	}

	if IsAPICall(c.App, r) {
		Handle404(c.App, w, r)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")

	staticDir, _ := fileutils.FindDir(model.ClientDir)
	contents, err := os.ReadFile(filepath.Join(staticDir, "root.html"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	titleTemplate := "<title>%s</title>"
	originalHTML := fmt.Sprintf(titleTemplate, html.EscapeString(model.TeamSettingsDefaultSiteName))
	modifiedHTML := getOpenGraphMetaTags(c)
	if originalHTML != modifiedHTML {
		contents = bytes.ReplaceAll(contents, []byte(originalHTML), []byte(modifiedHTML))
	}

	w.Header().Set("Content-Type", "text/html")
	w.Write(contents)
}

func staticFilesHandler(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		//wrap our ResponseWriter with our no-cache 404-handler
		w = &notFoundNoCacheResponseWriter{ResponseWriter: w}

		w.Header().Set("Cache-Control", "max-age=31556926, public")

		if strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}

		handler.ServeHTTP(w, r)
	})
}

type notFoundNoCacheResponseWriter struct {
	http.ResponseWriter
}

func (w *notFoundNoCacheResponseWriter) WriteHeader(statusCode int) {
	if statusCode == http.StatusNotFound {
		// we have a 404, update our cache header first then fall through
		w.Header().Set("Cache-Control", "no-cache, public")
	}
	w.ResponseWriter.WriteHeader(statusCode)
}

func robotsHandler(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/") {
		http.NotFound(w, r)
		return
	}
	w.Write(robotsTxt)
}

func unsupportedBrowserScriptHandler(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/") {
		http.NotFound(w, r)
		return
	}

	templatesDir, _ := templates.GetTemplateDirectory()
	http.ServeFile(w, r, filepath.Join(templatesDir, "unsupported_browser.js"))
}

func getOpenGraphMetaTags(c *Context) string {
	siteName := model.TeamSettingsDefaultSiteName
	customSiteName := c.App.Srv().Config().TeamSettings.SiteName
	if customSiteName != nil && *customSiteName != "" {
		siteName = *customSiteName
	}

	siteDescription := model.TeamSettingsDefaultCustomDescriptionText
	customSiteDescription := c.App.Srv().Config().TeamSettings.CustomDescriptionText
	if customSiteDescription != nil && *customSiteDescription != "" {
		siteDescription = *customSiteDescription
	}

	titleTemplate := "<title>%s</title>"
	titleHTML := fmt.Sprintf(titleTemplate, html.EscapeString(siteName))

	if siteDescription != "" {
		descriptionTemplate := "<meta property=\"og:description\" content=\"%s\" />"
		descriptionHTML := fmt.Sprintf(descriptionTemplate, html.EscapeString(siteDescription))
		return fmt.Sprintf("%s%s", titleHTML, descriptionHTML)
	}

	return titleHTML
}
