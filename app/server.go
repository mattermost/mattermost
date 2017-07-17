// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"crypto/tls"
	"net"
	"net/http"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/rsc/letsencrypt"
	"github.com/tylerb/graceful"
	"gopkg.in/throttled/throttled.v2"
	"gopkg.in/throttled/throttled.v2/store/memstore"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

type Server struct {
	Store           store.Store
	WebSocketRouter *WebSocketRouter
	Router          *mux.Router
	GracefulServer  *graceful.Server
}

var allowedMethods []string = []string{
	"POST",
	"GET",
	"OPTIONS",
	"PUT",
	"PATCH",
	"DELETE",
}

type RecoveryLogger struct {
}

func (rl *RecoveryLogger) Println(i ...interface{}) {
	l4g.Error("Please check the std error output for the stack trace")
	l4g.Error(i)
}

type CorsWrapper struct {
	router *mux.Router
}

func (cw *CorsWrapper) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if len(*utils.Cfg.ServiceSettings.AllowCorsFrom) > 0 {
		if utils.OriginChecker(r) {
			w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))

			if r.Method == "OPTIONS" {
				w.Header().Set(
					"Access-Control-Allow-Methods",
					strings.Join(allowedMethods, ", "))

				w.Header().Set(
					"Access-Control-Allow-Headers",
					r.Header.Get("Access-Control-Request-Headers"))
			}
		}
	}

	if r.Method == "OPTIONS" {
		return
	}

	cw.router.ServeHTTP(w, r)
}

const TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN = time.Second

var Srv *Server

func NewServer() {
	l4g.Info(utils.T("api.server.new_server.init.info"))

	Srv = &Server{}
}

func InitStores() {
	Srv.Store = store.NewLayeredStore()
}

type VaryBy struct{}

func (m *VaryBy) Key(r *http.Request) string {
	return utils.GetIpAddress(r)
}

func initalizeThrottledVaryBy() *throttled.VaryBy {
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

	return &vary
}

func redirectHTTPToHTTPS(w http.ResponseWriter, r *http.Request) {
	if r.Host == "" {
		http.Error(w, "Not Found", http.StatusNotFound)
	}

	url := r.URL
	url.Host = r.Host
	url.Scheme = "https"
	http.Redirect(w, r, url.String(), http.StatusFound)
}

func StartServer() {
	l4g.Info(utils.T("api.server.start_server.starting.info"))

	var handler http.Handler = &CorsWrapper{Srv.Router}

	if *utils.Cfg.RateLimitSettings.Enable {
		l4g.Info(utils.T("api.server.start_server.rate.info"))

		store, err := memstore.New(utils.Cfg.RateLimitSettings.MemoryStoreSize)
		if err != nil {
			l4g.Critical(utils.T("api.server.start_server.rate_limiting_memory_store"))
			return
		}

		quota := throttled.RateQuota{
			MaxRate:  throttled.PerSec(utils.Cfg.RateLimitSettings.PerSec),
			MaxBurst: *utils.Cfg.RateLimitSettings.MaxBurst,
		}

		rateLimiter, err := throttled.NewGCRARateLimiter(store, quota)
		if err != nil {
			l4g.Critical(utils.T("api.server.start_server.rate_limiting_rate_limiter"))
			return
		}

		httpRateLimiter := throttled.HTTPRateLimiter{
			RateLimiter: rateLimiter,
			VaryBy:      &VaryBy{},
			DeniedHandler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				l4g.Error("%v: Denied due to throttling settings code=429 ip=%v", r.URL.Path, utils.GetIpAddress(r))
				throttled.DefaultDeniedHandler.ServeHTTP(w, r)
			}),
		}

		handler = httpRateLimiter.RateLimit(handler)
	}

	Srv.GracefulServer = &graceful.Server{
		Timeout: TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN,
		Server: &http.Server{
			Addr:         utils.Cfg.ServiceSettings.ListenAddress,
			Handler:      handlers.RecoveryHandler(handlers.RecoveryLogger(&RecoveryLogger{}), handlers.PrintRecoveryStack(true))(handler),
			ReadTimeout:  time.Duration(*utils.Cfg.ServiceSettings.ReadTimeout) * time.Second,
			WriteTimeout: time.Duration(*utils.Cfg.ServiceSettings.WriteTimeout) * time.Second,
		},
	}
	l4g.Info(utils.T("api.server.start_server.listening.info"), utils.Cfg.ServiceSettings.ListenAddress)

	if *utils.Cfg.ServiceSettings.Forward80To443 {
		go func() {
			listener, err := net.Listen("tcp", ":80")
			if err != nil {
				l4g.Error("Unable to setup forwarding")
				return
			}
			defer listener.Close()

			http.Serve(listener, http.HandlerFunc(redirectHTTPToHTTPS))
		}()
	}

	go func() {
		var err error
		if *utils.Cfg.ServiceSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
			if *utils.Cfg.ServiceSettings.UseLetsEncrypt {
				var m letsencrypt.Manager
				m.CacheFile(*utils.Cfg.ServiceSettings.LetsEncryptCertificateCacheFile)

				tlsConfig := &tls.Config{
					GetCertificate: m.GetCertificate,
				}

				tlsConfig.NextProtos = append(tlsConfig.NextProtos, "h2")

				err = Srv.GracefulServer.ListenAndServeTLSConfig(tlsConfig)
			} else {
				err = Srv.GracefulServer.ListenAndServeTLS(*utils.Cfg.ServiceSettings.TLSCertFile, *utils.Cfg.ServiceSettings.TLSKeyFile)
			}
		} else {
			err = Srv.GracefulServer.ListenAndServe()
		}
		if err != nil {
			l4g.Critical(utils.T("api.server.start_server.starting.critical"), err)
			time.Sleep(time.Second)
		}
	}()
}

func StopServer() {

	l4g.Info(utils.T("api.server.stop_server.stopping.info"))

	Srv.GracefulServer.Stop(TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN)
	Srv.Store.Close()
	HubStop()

	l4g.Info(utils.T("api.server.stop_server.stopped.info"))
}
