// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"context"
	"crypto/tls"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/rsc/letsencrypt"
	"gopkg.in/throttled/throttled.v2"
	"gopkg.in/throttled/throttled.v2/store/memstore"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

type Server struct {
	Store           store.Store
	WebSocketRouter *WebSocketRouter
	Router          *mux.Router
	Server          *http.Server
	ListenAddr      *net.TCPAddr

	didFinishListen chan struct{}
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
	config model.ConfigFunc
	router *mux.Router
}

func (cw *CorsWrapper) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if allowed := *cw.config().ServiceSettings.AllowCorsFrom; allowed != "" {
		if utils.CheckOrigin(r, allowed) {
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

type VaryBy struct{}

func (m *VaryBy) Key(r *http.Request) string {
	return utils.GetIpAddress(r)
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

func (a *App) StartServer() {
	l4g.Info(utils.T("api.server.start_server.starting.info"))

	var handler http.Handler = &CorsWrapper{a.Config, a.Srv.Router}

	if *a.Config().RateLimitSettings.Enable {
		l4g.Info(utils.T("api.server.start_server.rate.info"))

		store, err := memstore.New(*a.Config().RateLimitSettings.MemoryStoreSize)
		if err != nil {
			l4g.Critical(utils.T("api.server.start_server.rate_limiting_memory_store"))
			return
		}

		quota := throttled.RateQuota{
			MaxRate:  throttled.PerSec(*a.Config().RateLimitSettings.PerSec),
			MaxBurst: *a.Config().RateLimitSettings.MaxBurst,
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

	a.Srv.Server = &http.Server{
		Handler:      handlers.RecoveryHandler(handlers.RecoveryLogger(&RecoveryLogger{}), handlers.PrintRecoveryStack(true))(handler),
		ReadTimeout:  time.Duration(*a.Config().ServiceSettings.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(*a.Config().ServiceSettings.WriteTimeout) * time.Second,
	}

	addr := *a.Config().ServiceSettings.ListenAddress
	if addr == "" {
		if *a.Config().ServiceSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
			addr = ":https"
		} else {
			addr = ":http"
		}
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		l4g.Critical(utils.T("api.server.start_server.starting.critical"), err)
		return
	}
	a.Srv.ListenAddr = listener.Addr().(*net.TCPAddr)

	l4g.Info(utils.T("api.server.start_server.listening.info"), listener.Addr().String())

	if *a.Config().ServiceSettings.Forward80To443 {
		go func() {
			redirectListener, err := net.Listen("tcp", ":80")
			if err != nil {
				listener.Close()
				l4g.Error("Unable to setup forwarding: " + err.Error())
				return
			}
			defer redirectListener.Close()

			http.Serve(redirectListener, http.HandlerFunc(redirectHTTPToHTTPS))
		}()
	}

	a.Srv.didFinishListen = make(chan struct{})
	go func() {
		var err error
		if *a.Config().ServiceSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
			if *a.Config().ServiceSettings.UseLetsEncrypt {
				var m letsencrypt.Manager
				m.CacheFile(*a.Config().ServiceSettings.LetsEncryptCertificateCacheFile)

				tlsConfig := &tls.Config{
					GetCertificate: m.GetCertificate,
				}

				tlsConfig.NextProtos = append(tlsConfig.NextProtos, "h2")

				a.Srv.Server.TLSConfig = tlsConfig
				err = a.Srv.Server.ServeTLS(listener, "", "")
			} else {
				err = a.Srv.Server.ServeTLS(listener, *a.Config().ServiceSettings.TLSCertFile, *a.Config().ServiceSettings.TLSKeyFile)
			}
		} else {
			err = a.Srv.Server.Serve(listener)
		}
		if err != nil && err != http.ErrServerClosed {
			l4g.Critical(utils.T("api.server.start_server.starting.critical"), err)
			time.Sleep(time.Second)
		}
		close(a.Srv.didFinishListen)
	}()
}

type tcpKeepAliveListener struct {
	*net.TCPListener
}

func (ln tcpKeepAliveListener) Accept() (c net.Conn, err error) {
	tc, err := ln.AcceptTCP()
	if err != nil {
		return
	}
	tc.SetKeepAlive(true)
	tc.SetKeepAlivePeriod(3 * time.Minute)
	return tc, nil
}

func (a *App) Listen(addr string) (net.Listener, error) {
	if addr == "" {
		addr = ":http"
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, err
	}
	return tcpKeepAliveListener{ln.(*net.TCPListener)}, nil
}

func (a *App) StopServer() {
	if a.Srv.Server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN)
		defer cancel()
		didShutdown := false
		for a.Srv.didFinishListen != nil && !didShutdown {
			if err := a.Srv.Server.Shutdown(ctx); err != nil {
				l4g.Warn(err.Error())
			}
			timer := time.NewTimer(time.Millisecond * 50)
			select {
			case <-a.Srv.didFinishListen:
				didShutdown = true
			case <-timer.C:
			}
			timer.Stop()
		}
		a.Srv.Server.Close()
		a.Srv.Server = nil
	}
}

func (a *App) OriginChecker() func(*http.Request) bool {
	if allowed := *a.Config().ServiceSettings.AllowCorsFrom; allowed != "" {
		return utils.OriginChecker(allowed)
	}
	return nil
}

// This is required to re-use the underlying connection and not take up file descriptors
func consumeAndClose(r *http.Response) {
	if r.Body != nil {
		io.Copy(ioutil.Discard, r.Body)
		r.Body.Close()
	}
}
