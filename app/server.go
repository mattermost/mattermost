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
	"path"
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

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/services/httpservice"
	"github.com/mattermost/mattermost-server/services/mailservice"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/utils"
)

var MaxNotificationsPerChannelDefault int64 = 1000000

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

	HTTPService httpservice.HTTPService

	Log *mlog.Logger

	AccountMigration einterfaces.AccountMigrationInterface
	Cluster          einterfaces.ClusterInterface
	Compliance       einterfaces.ComplianceInterface
	DataRetention    einterfaces.DataRetentionInterface
	Elasticsearch    einterfaces.ElasticsearchInterface
	Ldap             einterfaces.LdapInterface
	MessageExport    einterfaces.MessageExportInterface
	Metrics          einterfaces.MetricsInterface
	Saml             einterfaces.SamlInterface
}

// This is a bridge between the old and new initalization for the context refactor.
// It calls app layer initalization code that then turns around and acts on the server.
// Don't add anything new here, new initilization should be done in the server and
// performed in the NewServer function.
func (s *Server) RunOldAppInitalization() error {
	a := s.FakeApp()

	a.CreatePushNotificationsHub()
	a.StartPushNotificationsHubWorkers()

	if utils.T == nil {
		if err := utils.TranslationsPreInit(); err != nil {
			return errors.Wrapf(err, "unable to load Mattermost translation files")
		}
	}
	model.AppErrorInit(utils.T)

	a.LoadTimezones()

	if err := utils.InitTranslations(a.Config().LocalizationSettings); err != nil {
		return errors.Wrapf(err, "unable to load Mattermost translation files")
	}

	a.Srv.configListenerId = a.AddConfigListener(func(_, _ *model.Config) {
		a.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CONFIG_CHANGED, "", "", "", nil)

		message.Add("config", a.ClientConfigWithComputed())
		a.Srv.Go(func() {
			a.Publish(message)
		})
	})
	a.Srv.licenseListenerId = a.AddLicenseListener(func() {
		a.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LICENSE_CHANGED, "", "", "", nil)
		message.Add("license", a.GetSanitizedClientLicense())
		a.Srv.Go(func() {
			a.Publish(message)
		})

	})

	if err := a.SetupInviteEmailRateLimiting(); err != nil {
		return err
	}

	mlog.Info("Server is initializing...")

	s.initEnterprise()

	if a.Srv.newStore == nil {
		a.Srv.newStore = func() store.Store {
			return store.NewLayeredStore(sqlstore.NewSqlSupplier(a.Config().SqlSettings, a.Metrics), a.Metrics, a.Cluster)
		}
	}

	if htmlTemplateWatcher, err := utils.NewHTMLTemplateWatcher("templates"); err != nil {
		mlog.Error(fmt.Sprintf("Failed to parse server templates %v", err))
	} else {
		a.Srv.htmlTemplateWatcher = htmlTemplateWatcher
	}

	a.Srv.Store = a.Srv.newStore()

	if err := a.ensureAsymmetricSigningKey(); err != nil {
		return errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}

	if err := a.ensureInstallationDate(); err != nil {
		return errors.Wrapf(err, "unable to ensure installation date")
	}

	a.EnsureDiagnosticId()
	a.regenerateClientConfig()

	s.initJobs()
	a.AddLicenseListener(func() {
		s.initJobs()
	})

	a.Srv.clusterLeaderListenerId = a.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if job schedulers should be running:", mlog.Bool("isLeader", a.IsLeader()))
		a.Srv.Jobs.Schedulers.HandleClusterLeaderChange(a.IsLeader())
	})

	subpath, err := utils.GetSubpathFromConfig(a.Config())
	if err != nil {
		return errors.Wrap(err, "failed to parse SiteURL subpath")
	}
	a.Srv.Router = a.Srv.RootRouter.PathPrefix(subpath).Subrouter()
	a.Srv.Router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}", a.ServePluginRequest)
	a.Srv.Router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}/{anything:.*}", a.ServePluginRequest)

	// If configured with a subpath, redirect 404s at the root back into the subpath.
	if subpath != "/" {
		a.Srv.RootRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = path.Join(subpath, r.URL.Path)
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		})
	}
	a.Srv.Router.NotFoundHandler = http.HandlerFunc(a.Handle404)

	a.Srv.WebSocketRouter = &WebSocketRouter{
		app:      a,
		handlers: make(map[string]webSocketHandler),
	}

	mailservice.TestConnection(a.Config())

	if _, err := url.ParseRequestURI(*a.Config().ServiceSettings.SiteURL); err != nil {
		mlog.Error("SiteURL must be set. Some features will operate incorrectly if the SiteURL is not set. See documentation for details: http://about.mattermost.com/default-site-url")
	}

	backend, appErr := a.FileBackend()
	if appErr == nil {
		appErr = backend.TestConnection()
	}
	if appErr != nil {
		mlog.Error("Problem with file storage settings: " + appErr.Error())
	}

	if model.BuildEnterpriseReady == "true" {
		a.LoadLicense()
	}

	a.DoAdvancedPermissionsMigration()
	a.DoEmojisPermissionsMigration()

	a.InitPostMetadata()

	a.InitPlugins(*a.Config().PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory)
	a.AddConfigListener(func(prevCfg, cfg *model.Config) {
		if *cfg.PluginSettings.Enable {
			a.InitPlugins(*cfg.PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory)
		} else {
			a.ShutDownPlugins()
		}
	})

	return nil
}

func NewServer(options ...Option) (*Server, error) {
	rootRouter := mux.NewRouter()

	s := &Server{
		goroutineExitSignal: make(chan struct{}, 1),
		RootRouter:          rootRouter,
		configFile:          "config.json",
		configListeners:     make(map[string]func(*model.Config, *model.Config)),
		licenseListeners:    map[string]func(){},
		sessionCache:        utils.NewLru(model.SESSION_CACHE_SIZE),
		clientConfig:        make(map[string]string),
	}
	for _, option := range options {
		option(s)
	}

	if err := s.LoadConfig(s.configFile); err != nil {
		return nil, err
	}

	s.EnableConfigWatch()

	// Initalize logging
	s.Log = mlog.NewLogger(utils.MloggerConfigFromLoggerConfig(&s.Config().LogSettings))

	// Redirect default golang logger to this logger
	mlog.RedirectStdLog(s.Log)

	// Use this app logger as the global logger (eventually remove all instances of global logging)
	mlog.InitGlobalLogger(s.Log)

	s.logListenerId = s.AddConfigListener(func(_, after *model.Config) {
		s.Log.ChangeLevels(utils.MloggerConfigFromLoggerConfig(&after.LogSettings))
	})

	s.HTTPService = httpservice.MakeHTTPService(s.FakeApp())

	err := s.RunOldAppInitalization()
	if err != nil {
		return nil, err
	}

	// Start email batching because it's not like the other jobs
	s.InitEmailBatching()
	s.AddConfigListener(func(_, _ *model.Config) {
		s.InitEmailBatching()
	})

	mlog.Info(fmt.Sprintf("Current version is %v (%v/%v/%v/%v)", model.CurrentVersion, model.BuildNumber, model.BuildDate, model.BuildHash, model.BuildHashEnterprise))
	mlog.Info(fmt.Sprintf("Enterprise Enabled: %v", model.BuildEnterpriseReady))
	pwd, _ := os.Getwd()
	mlog.Info(fmt.Sprintf("Current working directory is %v", pwd))
	mlog.Info(fmt.Sprintf("Loaded config file from %v", utils.FindConfigFile(s.configFile)))

	license := s.License()

	if license == nil && len(s.Config().SqlSettings.DataSourceReplicas) > 1 {
		mlog.Warn("More than 1 read replica functionality disabled by current license. Please contact your system administrator about upgrading your enterprise license.")
		s.UpdateConfig(func(cfg *model.Config) {
			cfg.SqlSettings.DataSourceReplicas = cfg.SqlSettings.DataSourceReplicas[:1]
		})
	}

	if license == nil {
		s.UpdateConfig(func(cfg *model.Config) {
			cfg.TeamSettings.MaxNotificationsPerChannel = &MaxNotificationsPerChannelDefault
		})
	}

	s.ReloadConfig()

	// Enable developer settings if this is a "dev" build
	if model.BuildNumber == "dev" {
		s.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })
	}

	if result := <-s.Store.Status().ResetAll(); result.Err != nil {
		mlog.Error(fmt.Sprint("Error to reset the server status.", result.Err.Error()))
	}

	return s, nil
}

// Global app opptions that should be applied to apps created by this server
func (s *Server) AppOptions() []AppOption {
	return []AppOption{
		ServerConnector(s),
	}
}

// A temporary bridge to deal with cases where the code is so tighly coupled that
// this is easier as a temporary solution
func (s *Server) FakeApp() *App {
	a := New(
		ServerConnector(s),
	)
	return a
}

func (s *Server) StartServer() error {
	return s.FakeApp().StartServer()
}

const TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN = time.Second

func (s *Server) StopHTTPServer() {
	if s.Server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN)
		defer cancel()
		didShutdown := false
		for s.didFinishListen != nil && !didShutdown {
			if err := s.Server.Shutdown(ctx); err != nil {
				mlog.Warn(err.Error())
			}
			timer := time.NewTimer(time.Millisecond * 50)
			select {
			case <-s.didFinishListen:
				didShutdown = true
			case <-timer.C:
			}
			timer.Stop()
		}
		s.Server.Close()
		s.Server = nil
	}
}

func (s *Server) RunOldAppShutdown() {
	a := s.FakeApp()
	a.HubStop()
	a.StopPushNotificationsHubWorkers()
	a.ShutDownPlugins()
	a.RemoveLicenseListener(s.licenseListenerId)
	a.RemoveClusterLeaderChangedListener(s.clusterLeaderListenerId)
}

func (s *Server) Shutdown() error {
	mlog.Info("Stopping Server...")

	s.RunOldAppShutdown()

	s.StopHTTPServer()
	s.WaitForGoroutines()

	if s.Store != nil {
		s.Store.Close()
	}

	if s.htmlTemplateWatcher != nil {
		s.htmlTemplateWatcher.Close()
	}

	s.RemoveConfigListener(s.configListenerId)
	s.RemoveConfigListener(s.logListenerId)

	s.DisableConfigWatch()

	if s.HTTPService != nil {
		s.HTTPService.Close()
	}
	mlog.Info("Server stopped")
	return nil
}

func (s *Server) License() *model.License {
	license, _ := s.licenseValue.Load().(*model.License)
	return license
}

// Go creates a goroutine, but maintains a record of it to ensure that execution completes before
// the server is shutdown.
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
