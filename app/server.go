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
	"os"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/acme/autocert"

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
	RateLimiter     *RateLimiter

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

type VaryBy struct {
	useIP   bool
	useAuth bool
}

func (m *VaryBy) Key(r *http.Request) string {
	key := ""

	if m.useAuth {
		token, tokenLocation := ParseAuthTokenFromRequest(r)
		if tokenLocation != TokenLocationNotFound {
			key += token
		} else if m.useIP { // If we don't find an authentication token and IP based is enabled, fall back to IP
			key += utils.GetIpAddress(r)
		}
	} else if m.useIP { // Only if Auth based is not enabed do we use a plain IP based
		key = utils.GetIpAddress(r)
	}

	return key
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

		rateLimiter, err := NewRateLimiter(&a.Config().RateLimitSettings)
		if err != nil {
			l4g.Critical(err.Error())
			return
		}

		a.Srv.RateLimiter = rateLimiter
		handler = rateLimiter.RateLimitHandler(handler)
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

	// Migration from old let's encrypt library
	if *a.Config().ServiceSettings.UseLetsEncrypt {
		if stat, err := os.Stat(*a.Config().ServiceSettings.LetsEncryptCertificateCacheFile); err == nil && !stat.IsDir() {
			os.Remove(*a.Config().ServiceSettings.LetsEncryptCertificateCacheFile)
		}
	}

	m := &autocert.Manager{
		Cache:  autocert.DirCache(*a.Config().ServiceSettings.LetsEncryptCertificateCacheFile),
		Prompt: autocert.AcceptTOS,
	}

	if *a.Config().ServiceSettings.Forward80To443 {
		if *a.Config().ServiceSettings.UseLetsEncrypt {
			go http.ListenAndServe(":http", m.HTTPHandler(nil))
		} else {
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
	}

	a.Srv.didFinishListen = make(chan struct{})
	go func() {
		var err error
		if *a.Config().ServiceSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
			if *a.Config().ServiceSettings.UseLetsEncrypt {

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
