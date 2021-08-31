package web

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"text/template"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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

	baseURL  string
	rootPath string
	port     int
	ssl      bool
	logger   *mlog.Logger
}

// NewServer creates a new instance of the webserver.
func NewServer(rootPath string, serverRoot string, port int, ssl, localOnly bool, logger *mlog.Logger) *Server {
	r := mux.NewRouter()

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
		Server: http.Server{
			Addr:    addr,
			Handler: r,
		},
		baseURL:  baseURL,
		rootPath: rootPath,
		port:     port,
		ssl:      ssl,
		logger:   logger,
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
	ws.Router().PathPrefix("/static").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join(ws.rootPath, "static")))))
	ws.Router().PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		indexTemplate, err := template.New("index").ParseFiles(path.Join(ws.rootPath, "index.html"))
		if err != nil {
			ws.logger.Error("Unable to serve the index.html file", mlog.Err(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		err = indexTemplate.ExecuteTemplate(w, "index.html", map[string]string{"BaseURL": ws.baseURL})
		if err != nil {
			ws.logger.Error("Unable to serve the index.html file", mlog.Err(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	})
}

// Start runs the web server and start listening for charsetnnections.
func (ws *Server) Start() {
	ws.registerRoutes()
	if ws.port == -1 {
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
