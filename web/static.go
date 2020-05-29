// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
	"github.com/mkraft/gziphandler"
)

var robotsTxt = []byte("User-agent: *\nDisallow: /\n")

// the static content types that are Brotli encoded rather than gzipped.
var brotliEncodedContent = map[string]string{
	"js":  "application/javascript",
	"css": "text/css",
}

var brotliContentTypes []string

func (w *Web) InitStatic() {
	if *w.ConfigService.Config().ServiceSettings.WebserverMode != "disabled" {
		if err := utils.UpdateAssetsSubpathFromConfig(w.ConfigService.Config()); err != nil {
			mlog.Error("Failed to update assets subpath from config", mlog.Err(err))
		}

		staticDir, _ := fileutils.FindDir(model.CLIENT_DIR)
		mlog.Debug("Using client directory", mlog.String("clientDir", staticDir))

		subpath, _ := utils.GetSubpathFromConfig(w.ConfigService.Config())

		staticHandler := brotliFilesHandler(staticFilesHandler(http.StripPrefix(path.Join(subpath, "static"), http.FileServer(http.Dir(staticDir)))))
		pluginHandler := staticFilesHandler(http.StripPrefix(path.Join(subpath, "static", "plugins"), http.FileServer(http.Dir(*w.ConfigService.Config().PluginSettings.ClientDirectory))))

		if *w.ConfigService.Config().ServiceSettings.WebserverMode == "gzip" {
			for _, ct := range brotliEncodedContent {
				brotliContentTypes = append(brotliContentTypes, ct)
			}

			everythingExceptBrotliGzipHandler, err := gziphandler.GzipHandlerWithOpts(gziphandler.ContentTypeExceptions(brotliContentTypes))
			if err != nil {
				mlog.Error("Failed to initialize gziphandler", mlog.Err(err))
			}

			staticHandler = everythingExceptBrotliGzipHandler(staticHandler)
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

	if !CheckClientCompatability(r.UserAgent()) {
		renderUnsupportedBrowser(c.App, w, r)
		return
	}

	if IsApiCall(c.App, r) {
		Handle404(c.App, w, r)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")

	staticDir, _ := fileutils.FindDir(model.CLIENT_DIR)
	http.ServeFile(w, r, filepath.Join(staticDir, "root.html"))
}

func acceptsEncodingBrotli(r *http.Request) bool {
	directives := strings.Fields(r.Header.Get("Accept-Encoding"))
	for _, directive := range directives {
		if strings.ToLower(directive) == "br" {
			return true
		}
	}
	return false
}

func requestingBrotliFileExtension(r *http.Request) (bool, string) {
	extension := r.URL.Path[strings.LastIndex(r.URL.Path, ".")+1:]
	for bx, ct := range brotliEncodedContent {
		if bx == extension {
			return true, ct
		}
	}
	return false, ""
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

func brotliFilesHandler(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if model.BuildNumber != "dev" {
			isRequestingBrotliFile, contentType := requestingBrotliFileExtension(r)
			if isRequestingBrotliFile && acceptsEncodingBrotli(r) {
				r.URL.Path = r.URL.Path + ".br"
				w.Header().Set("Content-Encoding", "br")
				w.Header().Set("Content-Type", contentType)
			}
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

	templatesDir, _ := fileutils.FindDir("templates")
	http.ServeFile(w, r, filepath.Join(templatesDir, "unsupported_browser.js"))
}
