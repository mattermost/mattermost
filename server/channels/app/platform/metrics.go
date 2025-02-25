// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/pprof"
	"path"
	"runtime"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	TimeToWaitForConnectionsToCloseOnServerShutdown = time.Second
	cpuProfileDuration                              = 5 * time.Second
)

type platformMetrics struct {
	server *http.Server
	router *mux.Router
	lock   sync.Mutex
	logger *mlog.Logger

	metricsImpl einterfaces.MetricsInterface

	cfgFn      func() *model.Config
	listenAddr string

	getPluginsEnv func() *plugin.Environment
}

// resetMetrics resets the metrics server. Clears the metrics if the metrics are disabled by the config.
func (ps *PlatformService) resetMetrics() error {
	if !*ps.Config().MetricsSettings.Enable {
		if ps.metrics != nil {
			return ps.metrics.stopMetricsServer()
		}
		return nil
	}

	if ps.metrics != nil {
		if err := ps.metrics.stopMetricsServer(); err != nil {
			return err
		}
	}

	ps.metrics = &platformMetrics{
		cfgFn:       ps.Config,
		metricsImpl: ps.metricsIFace,
		logger:      ps.logger,
		getPluginsEnv: func() *plugin.Environment {
			if ps.pluginEnv == nil {
				return nil
			}
			return ps.pluginEnv.GetPluginsEnvironment()
		},
	}

	if err := ps.metrics.initMetricsRouter(); err != nil {
		return err
	}

	if ps.metricsIFace != nil {
		ps.metricsIFace.Register()
	}

	return ps.metrics.startMetricsServer()
}

func (pm *platformMetrics) stopMetricsServer() error {
	pm.lock.Lock()
	defer pm.lock.Unlock()

	if pm.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), TimeToWaitForConnectionsToCloseOnServerShutdown)
		defer cancel()

		if err := pm.server.Shutdown(ctx); err != nil {
			return fmt.Errorf("could not shutdown metrics server: %v", err)
		}

		pm.logger.Info("Metrics and profiling server is stopped")
	}

	return nil
}

func (pm *platformMetrics) startMetricsServer() error {
	var notify chan struct{}
	pm.lock.Lock()
	defer func() {
		if notify != nil {
			<-notify
		}
		pm.lock.Unlock()
	}()

	l, err := net.Listen("tcp", *pm.cfgFn().MetricsSettings.ListenAddress)
	if err != nil {
		return err
	}

	notify = make(chan struct{})
	pm.server = &http.Server{
		Handler:      handlers.RecoveryHandler(handlers.PrintRecoveryStack(true))(pm.router),
		ReadTimeout:  time.Duration(*pm.cfgFn().ServiceSettings.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(*pm.cfgFn().ServiceSettings.WriteTimeout) * time.Second,
	}

	go func() {
		close(notify)
		if err := pm.server.Serve(l); err != nil && err != http.ErrServerClosed {
			pm.logger.Fatal(err.Error())
		}
	}()

	pm.listenAddr = l.Addr().String()
	pm.logger.Info("Metrics and profiling server is started", mlog.String("address", pm.listenAddr))
	return nil
}

func (pm *platformMetrics) initMetricsRouter() error {
	pm.router = mux.NewRouter()
	runtime.SetBlockProfileRate(*pm.cfgFn().MetricsSettings.BlockProfileRate)

	metricsPage := `
			<html>
				<body>{{if .}}
					<div><a href="/metrics">Metrics</a></div>{{end}}
					<div><a href="/debug/pprof/">Profiling Root</a></div>
					<div><a href="/debug/pprof/cmdline">Profiling Command Line</a></div>
					<div><a href="/debug/pprof/symbol">Profiling Symbols</a></div>
					<div><a href="/debug/pprof/goroutine">Profiling Goroutines</a></div>
					<div><a href="/debug/pprof/heap">Profiling Heap</a></div>
					<div><a href="/debug/pprof/threadcreate">Profiling Threads</a></div>
					<div><a href="/debug/pprof/block">Profiling Blocking</a></div>
					<div><a href="/debug/pprof/trace">Profiling Execution Trace</a></div>
					<div><a href="/debug/pprof/profile">Profiling CPU</a></div>
				</body>
			</html>
		`
	metricsPageTmpl, err := template.New("page").Parse(metricsPage)
	if err != nil {
		return errors.Wrap(err, "failed to create template")
	}

	rootHandler := func(w http.ResponseWriter, r *http.Request) {
		if err := metricsPageTmpl.Execute(w, pm.metricsImpl != nil); err != nil {
			pm.logger.Error("Failed to execute template", mlog.Err(err))
		}
	}

	pm.router.HandleFunc("/", rootHandler)
	pm.router.StrictSlash(true)

	pm.router.Handle("/debug", http.RedirectHandler("/", http.StatusMovedPermanently))
	pm.router.HandleFunc("/debug/pprof/", pprof.Index)
	pm.router.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	pm.router.HandleFunc("/debug/pprof/profile", pprof.Profile)
	pm.router.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	pm.router.HandleFunc("/debug/pprof/trace", pprof.Trace)

	// Manually add support for paths linked to by index page at /debug/pprof/
	pm.router.Handle("/debug/pprof/goroutine", pprof.Handler("goroutine"))
	pm.router.Handle("/debug/pprof/heap", pprof.Handler("heap"))
	pm.router.Handle("/debug/pprof/allocs", pprof.Handler("allocs"))
	pm.router.Handle("/debug/pprof/threadcreate", pprof.Handler("threadcreate"))
	pm.router.Handle("/debug/pprof/block", pprof.Handler("block"))
	pm.router.Handle("/debug/pprof/mutex", pprof.Handler("mutex"))

	// Plugins metrics route
	pluginsMetricsRoute := pm.router.PathPrefix("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}/metrics").Subrouter()
	pluginsMetricsRoute.HandleFunc("", pm.servePluginMetricsRequest)
	pluginsMetricsRoute.HandleFunc("/{anything:.*}", pm.servePluginMetricsRequest)

	return nil
}

func (pm *platformMetrics) servePluginMetricsRequest(w http.ResponseWriter, r *http.Request) {
	pluginID := mux.Vars(r)["plugin_id"]

	pluginsEnvironment := pm.getPluginsEnv()
	if pluginsEnvironment == nil {
		appErr := model.NewAppError("ServePluginMetricsRequest", "app.plugin.disabled.app_error",
			nil, "Enable plugins to serve plugin metric requests", http.StatusNotImplemented)
		mlog.Error(appErr.Error())
		w.WriteHeader(appErr.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		if _, writeErr := w.Write([]byte(appErr.ToJSON())); writeErr != nil {
			mlog.Error("Failed to write error response", mlog.Err(writeErr))
		}
		return
	}

	hooks, err := pluginsEnvironment.HooksForPlugin(pluginID)
	if err != nil {
		mlog.Debug("Access to route for non-existent plugin",
			mlog.String("missing_plugin_id", pluginID),
			mlog.String("url", r.URL.String()),
			mlog.Err(err))
		http.NotFound(w, r)
		return
	}

	subpath, err := utils.GetSubpathFromConfig(pm.cfgFn())
	if err != nil {
		appErr := model.NewAppError("ServePluginMetricsRequest", "app.plugin.subpath_parse.app_error",
			nil, "Failed to parse SiteURL subpath", http.StatusInternalServerError).Wrap(err)
		mlog.Error(appErr.Error())
		w.WriteHeader(appErr.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		if _, writeErr := w.Write([]byte(appErr.ToJSON())); writeErr != nil {
			mlog.Error("Failed to write error response", mlog.Err(writeErr))
		}
		return
	}

	r.URL.Path = strings.TrimPrefix(r.URL.Path, path.Join(subpath, "plugins", pluginID, "metrics"))

	// Passing an empty plugin context for the time being. To be decided whether we
	// should support forms of authentication in the future.
	hooks.ServeMetrics(&plugin.Context{}, w, r)
}

func (ps *PlatformService) HandleMetrics(route string, h http.Handler) {
	if ps.metrics != nil {
		ps.metrics.router.Handle(route, h)
	}
}

func (ps *PlatformService) RestartMetrics() error {
	return ps.resetMetrics()
}

func (ps *PlatformService) Metrics() einterfaces.MetricsInterface {
	if ps.metrics == nil {
		return nil
	}

	return ps.metricsIFace
}
