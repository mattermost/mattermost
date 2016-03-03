// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/braintree/manners"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"gopkg.in/throttled/throttled.v1"
	throttledStore "gopkg.in/throttled/throttled.v1/store"
	"net/http"
	"strings"
	"time"
)

type Server struct {
	Store  store.Store
	Router *mux.Router
}

type CorsWrapper struct {
	router *mux.Router
}

var Srv *Server

func NewServer() {

	l4g.Info(utils.T("api.server.new_server.init.info"))

	Srv = &Server{}
	Srv.Store = store.NewSqlStore()

	Srv.Router = mux.NewRouter()
	Srv.Router.NotFoundHandler = http.HandlerFunc(Handle404)
}

func StartServer() {
	l4g.Info(utils.T("api.server.start_server.starting.info"))
	l4g.Info(utils.T("api.server.start_server.listening.info"), utils.Cfg.ServiceSettings.ListenAddress)

	var handler http.Handler = &CorsWrapper{Srv.Router}

	if utils.Cfg.RateLimitSettings.EnableRateLimiter {
		l4g.Info(utils.T("api.server.start_server.rate.info"))

		vary := throttled.VaryBy{}

		if utils.Cfg.RateLimitSettings.VaryByRemoteAddr {
			vary.RemoteAddr = true
		}

		if len(utils.Cfg.RateLimitSettings.VaryByHeader) > 0 {
			vary.Headers = strings.Fields(utils.Cfg.RateLimitSettings.VaryByHeader)

			if utils.Cfg.RateLimitSettings.VaryByRemoteAddr {
				l4g.Warn(utils.T("api.server.start_server.rate.warn"))
				vary.RemoteAddr = false
			}
		}

		th := throttled.RateLimit(throttled.PerSec(utils.Cfg.RateLimitSettings.PerSec), &vary, throttledStore.NewMemStore(utils.Cfg.RateLimitSettings.MemoryStoreSize))

		th.DeniedHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			l4g.Error("%v: code=429 ip=%v", r.URL.Path, GetIpAddress(r))
			throttled.DefaultDeniedHandler.ServeHTTP(w, r)
		})

		handler = th.Throttle(&CorsWrapper{Srv.Router})
	}

	go func() {
		err := manners.ListenAndServe(utils.Cfg.ServiceSettings.ListenAddress, handler)
		if err != nil {
			l4g.Critical(utils.T("api.server.start_server.starting.critical"), err)
			time.Sleep(time.Second)
			panic(utils.T("api.server.start_server.starting.panic") + err.Error())
		}
	}()
}

func StopServer() {

	l4g.Info(utils.T("api.server.stop_server.stopping.info"))

	manners.Close()
	Srv.Store.Close()
	hub.Stop()

	l4g.Info(utils.T("api.server.stop_server.stopped.info"))
}
