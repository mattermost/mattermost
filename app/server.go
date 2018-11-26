// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"context"
	"crypto/ecdsa"
	"crypto/tls"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/rs/cors"
	"github.com/throttled/throttled"
	"golang.org/x/crypto/acme/autocert"

	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

type Server struct {
	Store           store.Store
	WebSocketRouter *WebSocketRouter

	// RootRouter is the starting point for all HTTP requests to the server.
	RootRouter *mux.Router

	// Router is the starting point for all web, api4 and ws requests to the server. It differs
	// from RootRouter only if the SiteURL contains a /subpath.
	Router *mux.Router

	Server      *http.Server
	ListenAddr  *net.TCPAddr
	RateLimiter *RateLimiter

	didFinishListen chan struct{}

	goroutineCount      int32
	goroutineExitSignal chan struct{}

	PluginsEnvironment     *plugin.Environment
	PluginConfigListenerId string
	PluginsLock            sync.RWMutex

	EmailBatching    *EmailBatchingJob
	EmailRateLimiter *throttled.GCRARateLimiter

	Hubs                        []*Hub
	HubsStopCheckingForDeadlock chan bool

	PushNotificationsHub PushNotificationsHub

	Jobs *jobs.JobServer

	config                 atomic.Value
	envConfig              map[string]interface{}
	configFile             string
	configListeners        map[string]func(*model.Config, *model.Config)
	clusterLeaderListeners sync.Map

	licenseValue       atomic.Value
	clientLicenseValue atomic.Value
	licenseListeners   map[string]func()

	timezones atomic.Value

	newStore func() store.Store

	htmlTemplateWatcher     *utils.HTMLTemplateWatcher
	sessionCache            *utils.Cache
	configListenerId        string
	licenseListenerId       string
	logListenerId           string
	clusterLeaderListenerId string
	disableConfigWatch      bool
	configWatcher           *utils.ConfigWatcher
	asymmetricSigningKey    *ecdsa.PrivateKey

	pluginCommands     []*PluginCommand
	pluginCommandsLock sync.RWMutex

	clientConfig        map[string]string
	clientConfigHash    string
	limitedClientConfig map[string]string
	diagnosticId        string

	phase2PermissionsMigrationComplete bool
}

// Go creates a goroutine, but maintains a record of it to ensure that execution completes before
// the app is destroyed.
func (s *Server) Go(f func()) {
	atomic.AddInt32(&s.goroutineCount, 1)

	go func() {
		f()

		atomic.AddInt32(&s.goroutineCount, -1)
		select {
		case s.goroutineExitSignal <- struct{}{}:
		default:
		}
	}()
}

// WaitForGoroutines blocks until all goroutines created by App.Go exit.
func (s *Server) WaitForGoroutines() {
	for atomic.LoadInt32(&s.goroutineCount) != 0 {
		<-s.goroutineExitSignal
	}
}

var corsAllowedMethods = []string{
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
	mlog.Error("Please check the std error output for the stack trace")
	mlog.Error(fmt.Sprint(i...))
}

const TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN = time.Second

// golang.org/x/crypto/acme/autocert/autocert.go
func handleHTTPRedirect(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" && r.Method != "HEAD" {
		http.Error(w, "Use HTTPS", http.StatusBadRequest)
		return
	}
	target := "https://" + stripPort(r.Host) + r.URL.RequestURI()
	http.Redirect(w, r, target, http.StatusFound)
}

// golang.org/x/crypto/acme/autocert/autocert.go
func stripPort(hostport string) string {
	host, _, err := net.SplitHostPort(hostport)
	if err != nil {
		return hostport
	}
	return net.JoinHostPort(host, "443")
}

func (a *App) StartServer() error {
	mlog.Info("Starting Server...")

	var handler http.Handler = a.Srv.RootRouter
	if allowedOrigins := *a.Config().ServiceSettings.AllowCorsFrom; allowedOrigins != "" {
		exposedCorsHeaders := *a.Config().ServiceSettings.CorsExposedHeaders
		allowCredentials := *a.Config().ServiceSettings.CorsAllowCredentials
		debug := *a.Config().ServiceSettings.CorsDebug
		corsWrapper := cors.New(cors.Options{
			AllowedOrigins:   strings.Fields(allowedOrigins),
			AllowedMethods:   corsAllowedMethods,
			AllowedHeaders:   []string{"*"},
			ExposedHeaders:   strings.Fields(exposedCorsHeaders),
			MaxAge:           86400,
			AllowCredentials: allowCredentials,
			Debug:            debug,
		})

		// If we have debugging of CORS turned on then forward messages to logs
		if debug {
			corsWrapper.Log = a.Log.StdLog(mlog.String("source", "cors"))
		}

		handler = corsWrapper.Handler(handler)
	}

	if *a.Config().RateLimitSettings.Enable {
		mlog.Info("RateLimiter is enabled")

		rateLimiter, err := NewRateLimiter(&a.Config().RateLimitSettings)
		if err != nil {
			return err
		}

		a.Srv.RateLimiter = rateLimiter
		handler = rateLimiter.RateLimitHandler(handler)
	}

	a.Srv.Server = &http.Server{
		Handler:      handlers.RecoveryHandler(handlers.RecoveryLogger(&RecoveryLogger{}), handlers.PrintRecoveryStack(true))(handler),
		ReadTimeout:  time.Duration(*a.Config().ServiceSettings.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(*a.Config().ServiceSettings.WriteTimeout) * time.Second,
		ErrorLog:     a.Log.StdLog(mlog.String("source", "httpserver")),
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
		errors.Wrapf(err, utils.T("api.server.start_server.starting.critical"), err)
		return err
	}
	a.Srv.ListenAddr = listener.Addr().(*net.TCPAddr)

	mlog.Info(fmt.Sprintf("Server is listening on %v", listener.Addr().String()))

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
		if host, port, err := net.SplitHostPort(addr); err != nil {
			mlog.Error("Unable to setup forwarding: " + err.Error())
		} else if port != "443" {
			return fmt.Errorf(utils.T("api.server.start_server.forward80to443.enabled_but_listening_on_wrong_port"), port)
		} else {
			httpListenAddress := net.JoinHostPort(host, "http")

			if *a.Config().ServiceSettings.UseLetsEncrypt {
				server := &http.Server{
					Addr:     httpListenAddress,
					Handler:  m.HTTPHandler(nil),
					ErrorLog: a.Log.StdLog(mlog.String("source", "le_forwarder_server")),
				}
				go server.ListenAndServe()
			} else {
				go func() {
					redirectListener, err := net.Listen("tcp", httpListenAddress)
					if err != nil {
						mlog.Error("Unable to setup forwarding: " + err.Error())
						return
					}
					defer redirectListener.Close()

					server := &http.Server{
						Handler:  http.HandlerFunc(handleHTTPRedirect),
						ErrorLog: a.Log.StdLog(mlog.String("source", "forwarder_server")),
					}
					server.Serve(redirectListener)
				}()
			}
		}
	} else if *a.Config().ServiceSettings.UseLetsEncrypt {
		return errors.New(utils.T("api.server.start_server.forward80to443.disabled_while_using_lets_encrypt"))
	}

	a.Srv.didFinishListen = make(chan struct{})
	go func() {
		var err error
		if *a.Config().ServiceSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {

			tlsConfig := &tls.Config{
				PreferServerCipherSuites: true,
				CurvePreferences:         []tls.CurveID{tls.CurveP521, tls.CurveP384, tls.CurveP256},
			}

			switch *a.Config().ServiceSettings.TLSMinVer {
			case "1.0":
				tlsConfig.MinVersion = tls.VersionTLS10
			case "1.1":
				tlsConfig.MinVersion = tls.VersionTLS11
			default:
				tlsConfig.MinVersion = tls.VersionTLS12
			}

			defaultCiphers := []uint16{
				tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
				tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
				tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
				tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
				tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
				tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
			}

			if len(a.Config().ServiceSettings.TLSOverwriteCiphers) == 0 {
				tlsConfig.CipherSuites = defaultCiphers
			} else {
				var cipherSuites []uint16
				for _, cipher := range a.Config().ServiceSettings.TLSOverwriteCiphers {
					value, ok := model.ServerTLSSupportedCiphers[cipher]

					if !ok {
						mlog.Warn("Unsupported cipher passed", mlog.String("cipher", cipher))
						continue
					}

					cipherSuites = append(cipherSuites, value)
				}

				if len(cipherSuites) == 0 {
					mlog.Warn("No supported ciphers passed, fallback to default cipher suite")
					cipherSuites = defaultCiphers
				}

				tlsConfig.CipherSuites = cipherSuites
			}

			certFile := ""
			keyFile := ""

			if *a.Config().ServiceSettings.UseLetsEncrypt {
				tlsConfig.GetCertificate = m.GetCertificate
				tlsConfig.NextProtos = append(tlsConfig.NextProtos, "h2")
			} else {
				certFile = *a.Config().ServiceSettings.TLSCertFile
				keyFile = *a.Config().ServiceSettings.TLSKeyFile
			}

			a.Srv.Server.TLSConfig = tlsConfig
			err = a.Srv.Server.ServeTLS(listener, certFile, keyFile)
		} else {
			err = a.Srv.Server.Serve(listener)
		}

		if err != nil && err != http.ErrServerClosed {
			mlog.Critical(fmt.Sprintf("Error starting server, err:%v", err))
			time.Sleep(time.Second)
		}

		close(a.Srv.didFinishListen)
	}()

	return nil
}

func (a *App) StopServer() {
	if a.Srv.Server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN)
		defer cancel()
		didShutdown := false
		for a.Srv.didFinishListen != nil && !didShutdown {
			if err := a.Srv.Server.Shutdown(ctx); err != nil {
				mlog.Warn(err.Error())
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
		if allowed != "*" {
			siteURL, err := url.Parse(*a.Config().ServiceSettings.SiteURL)
			if err == nil {
				siteURL.Path = ""
				allowed += " " + siteURL.String()
			}
		}

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
