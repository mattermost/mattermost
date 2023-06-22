// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// RoutedService defines the interface that is needed for any service to
// register themself in the web server to provide new endpoints. (see
// AddRoutes).
type RoutedService interface {
	RegisterRoutes(*mux.Router)
}

// Server is the structure responsible for managing our http web server.
type Server struct {
	http.Server

	baseURL    string
	rootPath   string
	basePrefix string
	port       int
	ssl        bool
	logger     mlog.LoggerIFace
}

// NewServer creates a new instance of the webserver.
func NewServer(rootPath string, serverRoot string, port int, ssl, localOnly bool, logger mlog.LoggerIFace) *Server {
	r := mux.NewRouter()

	basePrefix := os.Getenv("FOCALBOARD_HTTP_SERVER_BASEPATH")
	if basePrefix != "" {
		r = r.PathPrefix(basePrefix).Subrouter()
	}

	var addr string
	if localOnly {
		addr = fmt.Sprintf(`localhost:%d`, port)
	} else {
		addr = fmt.Sprintf(`:%d`, port)
	}

	baseURL := ""
	url, err := url.Parse(serverRoot)
	if err != nil {
		logger.Error("Invalid ServerRoot setting", mlog.Err(err))
	}
	baseURL = url.Path

	ws := &Server{
		// (TODO: Add ReadHeaderTimeout)
		Server: http.Server{ //nolint:gosec
			Addr:    addr,
			Handler: r,
		},
		baseURL:    baseURL,
		rootPath:   rootPath,
		port:       port,
		ssl:        ssl,
		logger:     logger,
		basePrefix: basePrefix,
	}

	return ws
}

func (ws *Server) Router() *mux.Router {
	return ws.Server.Handler.(*mux.Router)
}

// AddRoutes allows services to register themself in the webserver router and provide new endpoints.
func (ws *Server) AddRoutes(rs RoutedService) {
	rs.RegisterRoutes(ws.Router())
}

func (ws *Server) registerRoutes() {
	ws.Router().PathPrefix("/static").Handler(http.StripPrefix(ws.basePrefix+"/static/", http.FileServer(http.Dir(filepath.Join(ws.rootPath, "static")))))
	ws.Router().PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		indexTemplate, err := template.New("index").ParseFiles(path.Join(ws.rootPath, "index.html"))
		if err != nil {
			ws.logger.Log(errorOrWarn(), "Unable to serve the index.html file", mlog.Err(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		err = indexTemplate.ExecuteTemplate(w, "index.html", map[string]string{"BaseURL": ws.baseURL})
		if err != nil {
			ws.logger.Log(errorOrWarn(), "Unable to serve the index.html file", mlog.Err(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	})
}

// Start runs the web server and start listening for connections.
func (ws *Server) Start() {
	ws.registerRoutes()
	if ws.port == -1 {
		ws.logger.Debug("server not bind to any port")
		return
	}

	isSSL := ws.ssl && fileExists("./cert/cert.pem") && fileExists("./cert/key.pem")
	if isSSL {
		ws.logger.Info("https server started", mlog.Int("port", ws.port))
		go func() {
			if err := ws.ListenAndServeTLS("./cert/cert.pem", "./cert/key.pem"); err != nil {
				ws.logger.Fatal("ListenAndServeTLS", mlog.Err(err))
			}
		}()

		return
	}

	ws.logger.Info("http server started", mlog.Int("port", ws.port))
	go func() {
		if err := ws.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			ws.logger.Fatal("ListenAndServeTLS", mlog.Err(err))
		}
		ws.logger.Info("http server stopped")
	}()
}

func (ws *Server) Shutdown() error {
	return ws.Close()
}

// fileExists returns true if a file exists at the path.
func fileExists(path string) bool {
	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}

	return err == nil
}

// errorOrWarn returns a `warn` level if this server instance is running unit tests, otherwise `error`.
func errorOrWarn() mlog.Level {
	unitTesting := strings.ToLower(strings.TrimSpace(os.Getenv("FOCALBOARD_UNIT_TESTING")))
	if unitTesting == "1" || unitTesting == "y" || unitTesting == "t" {
		return mlog.LvlWarn
	}
	return mlog.LvlError
}
