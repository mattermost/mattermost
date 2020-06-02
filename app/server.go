// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"crypto/ecdsa"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/rs/cors"
	rudder "github.com/rudderlabs/analytics-go"
	analytics "github.com/segmentio/analytics-go"

	"github.com/throttled/throttled"
	"golang.org/x/crypto/acme/autocert"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/services/cache"
	"github.com/mattermost/mattermost-server/v5/services/cache/lru"
	"github.com/mattermost/mattermost-server/v5/services/cache2"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
	"github.com/mattermost/mattermost-server/v5/services/imageproxy"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/services/searchengine/bleveengine"
	"github.com/mattermost/mattermost-server/v5/services/timezones"
	"github.com/mattermost/mattermost-server/v5/services/tracing"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/utils"
)

var MaxNotificationsPerChannelDefault int64 = 1000000

type Server struct {
	sqlStore        *sqlstore.SqlSupplier
	Store           store.Store
	WebSocketRouter *WebSocketRouter

	// RootRouter is the starting point for all HTTP requests to the server.
	RootRouter *mux.Router

	// LocalRouter is the starting point for all the local UNIX socket
	// requests to the server
	LocalRouter *mux.Router

	// Router is the starting point for all web, api4 and ws requests to the server. It differs
	// from RootRouter only if the SiteURL contains a /subpath.
	Router *mux.Router

	Server      *http.Server
	ListenAddr  *net.TCPAddr
	RateLimiter *RateLimiter
	Busy        *Busy

	localModeServer *http.Server

	didFinishListen chan struct{}

	goroutineCount      int32
	goroutineExitSignal chan struct{}

	PluginsEnvironment     *plugin.Environment
	PluginConfigListenerId string
	PluginsLock            sync.RWMutex

	EmailBatching    *EmailBatchingJob
	EmailRateLimiter *throttled.GCRARateLimiter

	hubsLock sync.RWMutex
	hubs     []*Hub

	PushNotificationsHub PushNotificationsHub

	runjobs bool
	Jobs    *jobs.JobServer

	clusterLeaderListeners sync.Map

	licenseValue       atomic.Value
	clientLicenseValue atomic.Value
	licenseListeners   map[string]func(*model.License, *model.License)

	timezones *timezones.Timezones

	newStore func() store.Store

	htmlTemplateWatcher     *utils.HTMLTemplateWatcher
	sessionCache            cache2.Cache
	seenPendingPostIdsCache cache2.Cache
	statusCache             cache2.Cache
	configListenerId        string
	licenseListenerId       string
	logListenerId           string
	clusterLeaderListenerId string
	searchConfigListenerId  string
	searchLicenseListenerId string
	configStore             config.Store
	asymmetricSigningKey    *ecdsa.PrivateKey
	postActionCookieSecret  []byte

	pluginCommands     []*PluginCommand
	pluginCommandsLock sync.RWMutex

	clientConfig        atomic.Value
	clientConfigHash    atomic.Value
	limitedClientConfig atomic.Value

	diagnosticId     string
	diagnosticClient analytics.Client
	rudderClient     rudder.Client

	phase2PermissionsMigrationComplete bool

	HTTPService            httpservice.HTTPService
	pushNotificationClient *http.Client // TODO: move this to it's own package

	ImageProxy *imageproxy.ImageProxy

	Audit            *audit.Audit
	Log              *mlog.Logger
	NotificationsLog *mlog.Logger

	joinCluster       bool
	startMetrics      bool
	startSearchEngine bool

	SearchEngine *searchengine.Broker

	AccountMigration einterfaces.AccountMigrationInterface
	Cluster          einterfaces.ClusterInterface
	Compliance       einterfaces.ComplianceInterface
	DataRetention    einterfaces.DataRetentionInterface
	Ldap             einterfaces.LdapInterface
	MessageExport    einterfaces.MessageExportInterface
	Metrics          einterfaces.MetricsInterface
	Notification     einterfaces.NotificationInterface
	Saml             einterfaces.SamlInterface

	CacheProvider cache.Provider

	CacheProvider2 cache2.Provider

	tracer                      *tracing.Tracer
	timestampLastDiagnosticSent time.Time
}

func NewServer(options ...Option) (*Server, error) {
	rootRouter := mux.NewRouter()
	localRouter := mux.NewRouter()

	s := &Server{
		goroutineExitSignal: make(chan struct{}, 1),
		RootRouter:          rootRouter,
		LocalRouter:         localRouter,
		licenseListeners:    map[string]func(*model.License, *model.License){},
	}

	for _, option := range options {
		if err := option(s); err != nil {
			return nil, errors.Wrap(err, "failed to apply option")
		}
	}

	if s.configStore == nil {
		configStore, err := config.NewFileStore("config.json", true)
		if err != nil {
			return nil, errors.Wrap(err, "failed to load config")
		}

		s.configStore = configStore
	}

	if s.Log == nil {
		s.Log = mlog.NewLogger(utils.MloggerConfigFromLoggerConfig(&s.Config().LogSettings, utils.GetLogFileLocation))
	}

	if s.NotificationsLog == nil {
		notificationLogSettings := utils.GetLogSettingsFromNotificationsLogSettings(&s.Config().NotificationLogSettings)
		s.NotificationsLog = mlog.NewLogger(utils.MloggerConfigFromLoggerConfig(notificationLogSettings, utils.GetNotificationsLogFileLocation)).
			WithCallerSkip(1).With(mlog.String("logSource", "notifications"))
	}

	// Redirect default golang logger to this logger
	mlog.RedirectStdLog(s.Log)

	// Use this app logger as the global logger (eventually remove all instances of global logging)
	mlog.InitGlobalLogger(s.Log)

	if *s.Config().LogSettings.EnableDiagnostics && *s.Config().LogSettings.EnableSentry {
		if strings.Contains(SENTRY_DSN, "placeholder") {
			mlog.Warn("Sentry reporting is enabled, but SENTRY_DSN is not set. Disabling reporting.")
		} else {
			if err := sentry.Init(sentry.ClientOptions{
				Dsn:              SENTRY_DSN,
				Release:          model.BuildHash,
				AttachStacktrace: true,
			}); err != nil {
				mlog.Warn("Sentry could not be initiated, probably bad DSN?", mlog.Err(err))
			}
		}
	}

	if *s.Config().ServiceSettings.EnableOpenTracing {
		tracer, err := tracing.New()
		if err != nil {
			return nil, err
		}
		s.tracer = tracer
	}

	s.logListenerId = s.AddConfigListener(func(_, after *model.Config) {
		s.Log.ChangeLevels(utils.MloggerConfigFromLoggerConfig(&after.LogSettings, utils.GetLogFileLocation))

		notificationLogSettings := utils.GetLogSettingsFromNotificationsLogSettings(&after.NotificationLogSettings)
		s.NotificationsLog.ChangeLevels(utils.MloggerConfigFromLoggerConfig(notificationLogSettings, utils.GetNotificationsLogFileLocation))
	})

	s.HTTPService = httpservice.MakeHTTPService(s)
	s.pushNotificationClient = s.HTTPService.MakeClient(true)

	s.ImageProxy = imageproxy.MakeImageProxy(s, s.HTTPService, s.Log)

	if err := utils.TranslationsPreInit(); err != nil {
		return nil, errors.Wrapf(err, "unable to load Mattermost translation files")
	}

	searchEngine := searchengine.NewBroker(s.Config(), s.Jobs)
	bleveEngine := bleveengine.NewBleveEngine(s.Config(), s.Jobs)
	if err := bleveEngine.Start(); err != nil {
		return nil, err
	}
	searchEngine.RegisterBleveEngine(bleveEngine)
	s.SearchEngine = searchEngine

	// at the moment we only have this implementation
	// in the future the cache provider will be built based on the loaded config
	s.CacheProvider = new(lru.CacheProvider)

	s.CacheProvider.Connect()

	s.CacheProvider2 = cache2.NewProvider()
	if err := s.CacheProvider2.Connect(); err != nil {
		return nil, errors.Wrapf(err, "Unable to connect to cache provider")
	}

	s.sessionCache = s.CacheProvider2.NewCache(&cache2.CacheOptions{
		Size: model.SESSION_CACHE_SIZE,
	})
	s.seenPendingPostIdsCache = s.CacheProvider2.NewCache(&cache2.CacheOptions{
		Size: PENDING_POST_IDS_CACHE_SIZE,
	})
	s.statusCache = s.CacheProvider2.NewCache(&cache2.CacheOptions{
		Size: model.STATUS_CACHE_SIZE,
	})

	if err := s.RunOldAppInitialization(); err != nil {
		return nil, err
	}

	model.AppErrorInit(utils.T)

	s.timezones = timezones.New()
	// Start email batching because it's not like the other jobs
	s.InitEmailBatching()
	s.AddConfigListener(func(_, _ *model.Config) {
		s.InitEmailBatching()
	})

	// Start plugin health check job
	pluginsEnvironment := s.PluginsEnvironment
	if pluginsEnvironment != nil {
		pluginsEnvironment.InitPluginHealthCheckJob(*s.Config().PluginSettings.Enable && *s.Config().PluginSettings.EnableHealthCheck)
	}
	s.AddConfigListener(func(_, c *model.Config) {
		pluginsEnvironment := s.PluginsEnvironment
		if pluginsEnvironment != nil {
			pluginsEnvironment.InitPluginHealthCheckJob(*s.Config().PluginSettings.Enable && *c.PluginSettings.EnableHealthCheck)
		}
	})

	logCurrentVersion := fmt.Sprintf("Current version is %v (%v/%v/%v/%v)", model.CurrentVersion, model.BuildNumber, model.BuildDate, model.BuildHash, model.BuildHashEnterprise)
	mlog.Info(
		logCurrentVersion,
		mlog.String("current_version", model.CurrentVersion),
		mlog.String("build_number", model.BuildNumber),
		mlog.String("build_date", model.BuildDate),
		mlog.String("build_hash", model.BuildHash),
		mlog.String("build_hash_enterprise", model.BuildHashEnterprise),
	)
	if model.BuildEnterpriseReady == "true" {
		mlog.Info("Enterprise Build", mlog.Bool("enterprise_build", true))
	} else {
		mlog.Info("Team Edition Build", mlog.Bool("enterprise_build", false))
	}

	pwd, _ := os.Getwd()
	mlog.Info("Printing current working", mlog.String("directory", pwd))
	mlog.Info("Loaded config", mlog.String("source", s.configStore.String()))

	s.checkPushNotificationServerUrl()

	license := s.License()

	if license == nil {
		s.UpdateConfig(func(cfg *model.Config) {
			cfg.TeamSettings.MaxNotificationsPerChannel = &MaxNotificationsPerChannelDefault
		})
	}

	s.ReloadConfig()

	if s.Audit == nil {
		s.Audit = &audit.Audit{}
		s.Audit.Init(audit.DefMaxQueueSize)
		s.configureAudit(s.Audit)
	}

	// Enable developer settings if this is a "dev" build
	if model.BuildNumber == "dev" {
		s.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })
	}

	if err := s.Store.Status().ResetAll(); err != nil {
		mlog.Error("Error to reset the server status.", mlog.Err(err))
	}

	// Scheduler must be started before cluster.
	s.initJobs()

	if s.joinCluster && s.Cluster != nil {
		s.FakeApp().registerAllClusterMessageHandlers()
		s.Cluster.StartInterNodeCommunication()
	}

	if s.startMetrics && s.Metrics != nil {
		s.Metrics.StartServer()
	}

	s.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if *oldConfig.GuestAccountsSettings.Enable && !*newConfig.GuestAccountsSettings.Enable {
			if appErr := s.FakeApp().DeactivateGuests(); appErr != nil {
				mlog.Error("Unable to deactivate guest accounts", mlog.Err(appErr))
			}
		}
	})

	// Disable active guest accounts on first run if guest accounts are disabled
	if !*s.Config().GuestAccountsSettings.Enable {
		if appErr := s.FakeApp().DeactivateGuests(); appErr != nil {
			mlog.Error("Unable to deactivate guest accounts", mlog.Err(appErr))
		}
	}

	if s.runjobs {
		s.Go(func() {
			runSecurityJob(s)
		})
		s.Go(func() {
			runDiagnosticsJob(s)
		})
		s.Go(func() {
			runSessionCleanupJob(s)
		})
		s.Go(func() {
			runTokenCleanupJob(s)
		})
		s.Go(func() {
			runCommandWebhookCleanupJob(s)
		})
		s.Go(func() {
			runLicenseExpirationCheckJob(s)
		})

		if complianceI := s.Compliance; complianceI != nil {
			complianceI.StartComplianceDailyJob()
		}

		if *s.Config().JobSettings.RunJobs && s.Jobs != nil {
			s.Jobs.StartWorkers()
		}
		if *s.Config().JobSettings.RunScheduler && s.Jobs != nil {
			s.Jobs.StartSchedulers()
		}
	}

	s.SearchEngine.UpdateConfig(s.Config())
	searchConfigListenerId, searchLicenseListenerId := s.StartSearchEngine()
	s.searchConfigListenerId = searchConfigListenerId
	s.searchLicenseListenerId = searchLicenseListenerId

	return s, nil
}

// Global app options that should be applied to apps created by this server
func (s *Server) AppOptions() []AppOption {
	return []AppOption{
		ServerConnector(s),
	}
}

const TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN = time.Second

func (s *Server) StopHTTPServer() {
	if s.Server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), TIME_TO_WAIT_FOR_CONNECTIONS_TO_CLOSE_ON_SERVER_SHUTDOWN)
		defer cancel()
		didShutdown := false
		for s.didFinishListen != nil && !didShutdown {
			if err := s.Server.Shutdown(ctx); err != nil {
				mlog.Warn("Unable to shutdown server", mlog.Err(err))
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

func (s *Server) Shutdown() error {
	mlog.Info("Stopping Server...")

	defer sentry.Flush(2 * time.Second)

	s.RunOldAppShutdown()

	if s.tracer != nil {
		if err := s.tracer.Close(); err != nil {
			mlog.Error("Unable to cleanly shutdown opentracing client", mlog.Err(err))
		}
	}

	err := s.shutdownDiagnostics()
	if err != nil {
		mlog.Error("Unable to cleanly shutdown diagnostic client", mlog.Err(err))
	}

	s.StopHTTPServer()
	s.stopLocalModeServer()

	s.WaitForGoroutines()

	if s.htmlTemplateWatcher != nil {
		s.htmlTemplateWatcher.Close()
	}

	s.RemoveConfigListener(s.configListenerId)
	s.RemoveConfigListener(s.logListenerId)
	s.stopSearchEngine()

	s.Audit.Shutdown()

	s.configStore.Close()

	if s.Cluster != nil {
		s.Cluster.StopInterNodeCommunication()
	}

	if s.Metrics != nil {
		s.Metrics.StopServer()
	}

	// This must be done after the cluster is stopped.
	if s.Jobs != nil && s.runjobs {
		s.Jobs.StopWorkers()
		s.Jobs.StopSchedulers()
	}

	if s.Store != nil {
		s.Store.Close()
	}

	if s.CacheProvider != nil {
		s.CacheProvider.Close()
	}

	if s.CacheProvider2 != nil {
		if err = s.CacheProvider2.Close(); err != nil {
			mlog.Error("Unable to cleanly shutdown cache", mlog.Err(err))
		}
	}

	mlog.Info("Server stopped")
	return nil
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

func (s *Server) Start() error {
	mlog.Info("Starting Server...")

	var handler http.Handler = s.RootRouter

	if *s.Config().LogSettings.EnableDiagnostics && *s.Config().LogSettings.EnableSentry && !strings.Contains(SENTRY_DSN, "placeholder") {
		sentryHandler := sentryhttp.New(sentryhttp.Options{
			Repanic: true,
		})
		handler = sentryHandler.Handle(handler)
	}

	if allowedOrigins := *s.Config().ServiceSettings.AllowCorsFrom; allowedOrigins != "" {
		exposedCorsHeaders := *s.Config().ServiceSettings.CorsExposedHeaders
		allowCredentials := *s.Config().ServiceSettings.CorsAllowCredentials
		debug := *s.Config().ServiceSettings.CorsDebug
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
			corsWrapper.Log = s.Log.StdLog(mlog.String("source", "cors"))
		}

		handler = corsWrapper.Handler(handler)
	}

	if *s.Config().RateLimitSettings.Enable {
		mlog.Info("RateLimiter is enabled")

		rateLimiter, err := NewRateLimiter(&s.Config().RateLimitSettings, s.Config().ServiceSettings.TrustedProxyIPHeader)
		if err != nil {
			return err
		}

		s.RateLimiter = rateLimiter
		handler = rateLimiter.RateLimitHandler(handler)
	}
	s.Busy = NewBusy(s.Cluster)

	// Creating a logger for logging errors from http.Server at error level
	errStdLog, err := s.Log.StdLogAt(mlog.LevelError, mlog.String("source", "httpserver"))
	if err != nil {
		return err
	}

	s.Server = &http.Server{
		Handler:      handler,
		ReadTimeout:  time.Duration(*s.Config().ServiceSettings.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(*s.Config().ServiceSettings.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(*s.Config().ServiceSettings.IdleTimeout) * time.Second,
		ErrorLog:     errStdLog,
	}

	addr := *s.Config().ServiceSettings.ListenAddress
	if addr == "" {
		if *s.Config().ServiceSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
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
	s.ListenAddr = listener.Addr().(*net.TCPAddr)

	logListeningPort := fmt.Sprintf("Server is listening on %v", listener.Addr().String())
	mlog.Info(logListeningPort, mlog.String("address", listener.Addr().String()))

	m := &autocert.Manager{
		Cache:  autocert.DirCache(*s.Config().ServiceSettings.LetsEncryptCertificateCacheFile),
		Prompt: autocert.AcceptTOS,
	}

	if *s.Config().ServiceSettings.Forward80To443 {
		if host, port, err := net.SplitHostPort(addr); err != nil {
			mlog.Error("Unable to setup forwarding", mlog.Err(err))
		} else if port != "443" {
			return fmt.Errorf(utils.T("api.server.start_server.forward80to443.enabled_but_listening_on_wrong_port"), port)
		} else {
			httpListenAddress := net.JoinHostPort(host, "http")

			if *s.Config().ServiceSettings.UseLetsEncrypt {
				server := &http.Server{
					Addr:     httpListenAddress,
					Handler:  m.HTTPHandler(nil),
					ErrorLog: s.Log.StdLog(mlog.String("source", "le_forwarder_server")),
				}
				go server.ListenAndServe()
			} else {
				go func() {
					redirectListener, err := net.Listen("tcp", httpListenAddress)
					if err != nil {
						mlog.Error("Unable to setup forwarding", mlog.Err(err))
						return
					}
					defer redirectListener.Close()

					server := &http.Server{
						Handler:  http.HandlerFunc(handleHTTPRedirect),
						ErrorLog: s.Log.StdLog(mlog.String("source", "forwarder_server")),
					}
					server.Serve(redirectListener)
				}()
			}
		}
	} else if *s.Config().ServiceSettings.UseLetsEncrypt {
		return errors.New(utils.T("api.server.start_server.forward80to443.disabled_while_using_lets_encrypt"))
	}

	s.didFinishListen = make(chan struct{})
	go func() {
		var err error
		if *s.Config().ServiceSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {

			tlsConfig := &tls.Config{
				PreferServerCipherSuites: true,
				CurvePreferences:         []tls.CurveID{tls.CurveP521, tls.CurveP384, tls.CurveP256},
			}

			switch *s.Config().ServiceSettings.TLSMinVer {
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

			if len(s.Config().ServiceSettings.TLSOverwriteCiphers) == 0 {
				tlsConfig.CipherSuites = defaultCiphers
			} else {
				var cipherSuites []uint16
				for _, cipher := range s.Config().ServiceSettings.TLSOverwriteCiphers {
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

			if *s.Config().ServiceSettings.UseLetsEncrypt {
				tlsConfig.GetCertificate = m.GetCertificate
				tlsConfig.NextProtos = append(tlsConfig.NextProtos, "h2")
			} else {
				certFile = *s.Config().ServiceSettings.TLSCertFile
				keyFile = *s.Config().ServiceSettings.TLSKeyFile
			}

			s.Server.TLSConfig = tlsConfig
			err = s.Server.ServeTLS(listener, certFile, keyFile)
		} else {
			err = s.Server.Serve(listener)
		}

		if err != nil && err != http.ErrServerClosed {
			mlog.Critical("Error starting server", mlog.Err(err))
			time.Sleep(time.Second)
		}

		close(s.didFinishListen)
	}()

	if *s.Config().ServiceSettings.EnableLocalMode {
		if err := s.startLocalModeServer(); err != nil {
			mlog.Critical(err.Error())
		}
	}

	return nil
}

func (s *Server) startLocalModeServer() error {
	s.localModeServer = &http.Server{
		Handler: s.LocalRouter,
	}

	socket := *s.configStore.Get().ServiceSettings.LocalModeSocketLocation
	unixListener, err := net.Listen("unix", socket)
	if err != nil {
		return errors.Wrapf(err, utils.T("api.server.start_server.starting.critical"), err)
	}
	if err = os.Chmod(socket, 0600); err != nil {
		return errors.Wrapf(err, utils.T("api.server.start_server.starting.critical"), err)
	}

	go func() {
		err = s.localModeServer.Serve(unixListener)
		if err != nil && err != http.ErrServerClosed {
			mlog.Critical("Error starting unix socket server", mlog.Err(err))
		}
	}()
	return nil
}

func (s *Server) stopLocalModeServer() {
	if s.localModeServer != nil {
		s.localModeServer.Close()
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

func (s *Server) checkPushNotificationServerUrl() {
	notificationServer := *s.Config().EmailSettings.PushNotificationServer
	if strings.HasPrefix(notificationServer, "http://") {
		mlog.Warn("Your push notification server is configured with HTTP. For improved security, update to HTTPS in your configuration.")
	}
}

func runSecurityJob(s *Server) {
	doSecurity(s)
	model.CreateRecurringTask("Security", func() {
		doSecurity(s)
	}, time.Hour*4)
}

func doDiagnosticsIfNeeded(s *Server, firstRun time.Time) {
	hoursSinceFirstServerRun := time.Since(firstRun).Hours()
	// Send once every 10 minutes for the first hour
	// Send once every hour thereafter for the first 12 hours
	// Send at the 24 hour mark and every 24 hours after
	if hoursSinceFirstServerRun < 1 {
		doDiagnostics(s)
	} else if hoursSinceFirstServerRun <= 12 && time.Since(s.timestampLastDiagnosticSent) >= time.Hour {
		doDiagnostics(s)
	} else if hoursSinceFirstServerRun > 12 && time.Since(s.timestampLastDiagnosticSent) >= 24*time.Hour {
		doDiagnostics(s)
	}
}

func runDiagnosticsJob(s *Server) {
	// Send on boot
	doDiagnostics(s)
	firstRun, err := s.FakeApp().getFirstServerRunTimestamp()
	if err != nil {
		mlog.Warn("Fetching time of first server run failed. Setting to 'now'.")
		s.FakeApp().ensureFirstServerRunTimestamp()
		firstRun = utils.MillisFromTime(time.Now())
	}
	model.CreateRecurringTask("Diagnostics", func() {
		doDiagnosticsIfNeeded(s, utils.TimeFromMillis(firstRun))
	}, time.Minute*10)
}

func runTokenCleanupJob(s *Server) {
	doTokenCleanup(s)
	model.CreateRecurringTask("Token Cleanup", func() {
		doTokenCleanup(s)
	}, time.Hour*1)
}

func runCommandWebhookCleanupJob(s *Server) {
	doCommandWebhookCleanup(s)
	model.CreateRecurringTask("Command Hook Cleanup", func() {
		doCommandWebhookCleanup(s)
	}, time.Hour*1)
}

func runSessionCleanupJob(s *Server) {
	doSessionCleanup(s)
	model.CreateRecurringTask("Session Cleanup", func() {
		doSessionCleanup(s)
	}, time.Hour*24)
}

func runLicenseExpirationCheckJob(s *Server) {
	doLicenseExpirationCheck(s)
	model.CreateRecurringTask("License Expiration Check", func() {
		doLicenseExpirationCheck(s)
	}, time.Hour*24)
}

func doSecurity(s *Server) {
	s.DoSecurityUpdateCheck()
}

func doDiagnostics(s *Server) {
	if *s.Config().LogSettings.EnableDiagnostics {
		s.timestampLastDiagnosticSent = time.Now()
		s.FakeApp().SendDailyDiagnostics()
	}
}

func doTokenCleanup(s *Server) {
	s.Store.Token().Cleanup()
}

func doCommandWebhookCleanup(s *Server) {
	s.Store.CommandWebhook().Cleanup()
}

const (
	SESSIONS_CLEANUP_BATCH_SIZE = 1000
)

func doSessionCleanup(s *Server) {
	s.Store.Session().Cleanup(model.GetMillis(), SESSIONS_CLEANUP_BATCH_SIZE)
}

func doLicenseExpirationCheck(s *Server) {
	s.FakeApp().LoadLicense()
	license := s.License()

	if license == nil {
		mlog.Debug("License cannot be found.")
		return
	}

	if !license.IsPastGracePeriod() {
		mlog.Debug("License is not past the grace period.")
		return
	}

	users, err := s.Store.User().GetSystemAdminProfiles()
	if err != nil {
		mlog.Error("Failed to get system admins for license expired message from Mattermost.")
		return
	}

	//send email to admin(s)
	for _, user := range users {
		user := user
		if user.Email == "" {
			mlog.Error("Invalid system admin email.", mlog.String("user_email", user.Email))
			continue
		}

		mlog.Debug("Sending license expired email.", mlog.String("user_email", user.Email))
		s.Go(func() {
			if err := s.FakeApp().SendRemoveExpiredLicenseEmail(user.Email, user.Locale, *s.Config().ServiceSettings.SiteURL, license.Id); err != nil {
				mlog.Error("Error while sending the license expired email.", mlog.String("user_email", user.Email), mlog.Err(err))
			}
		})
	}

	//remove the license
	s.FakeApp().RemoveLicense()
}

func (s *Server) StartSearchEngine() (string, string) {
	if s.SearchEngine.ElasticsearchEngine != nil && s.SearchEngine.ElasticsearchEngine.IsActive() {
		s.Go(func() {
			if err := s.SearchEngine.ElasticsearchEngine.Start(); err != nil {
				s.Log.Error(err.Error())
			}
		})
	}

	configListenerId := s.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if s.SearchEngine == nil {
			return
		}
		s.SearchEngine.UpdateConfig(newConfig)

		if s.SearchEngine.ElasticsearchEngine != nil && !*oldConfig.ElasticsearchSettings.EnableIndexing && *newConfig.ElasticsearchSettings.EnableIndexing {
			s.Go(func() {
				if err := s.SearchEngine.ElasticsearchEngine.Start(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else if s.SearchEngine.ElasticsearchEngine != nil && *oldConfig.ElasticsearchSettings.EnableIndexing && !*newConfig.ElasticsearchSettings.EnableIndexing {
			s.Go(func() {
				if err := s.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else if s.SearchEngine.ElasticsearchEngine != nil && *oldConfig.ElasticsearchSettings.Password != *newConfig.ElasticsearchSettings.Password || *oldConfig.ElasticsearchSettings.Username != *newConfig.ElasticsearchSettings.Username || *oldConfig.ElasticsearchSettings.ConnectionUrl != *newConfig.ElasticsearchSettings.ConnectionUrl || *oldConfig.ElasticsearchSettings.Sniff != *newConfig.ElasticsearchSettings.Sniff {
			s.Go(func() {
				if *oldConfig.ElasticsearchSettings.EnableIndexing {
					if err := s.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
						mlog.Error(err.Error())
					}
					if err := s.SearchEngine.ElasticsearchEngine.Start(); err != nil {
						mlog.Error(err.Error())
					}
				}
			})
		}
	})

	licenseListenerId := s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		if s.SearchEngine == nil {
			return
		}
		if oldLicense == nil && newLicense != nil {
			if s.SearchEngine.ElasticsearchEngine != nil && s.SearchEngine.ElasticsearchEngine.IsActive() {
				s.Go(func() {
					if err := s.SearchEngine.ElasticsearchEngine.Start(); err != nil {
						mlog.Error(err.Error())
					}
				})
			}
		} else if oldLicense != nil && newLicense == nil {
			if s.SearchEngine.ElasticsearchEngine != nil {
				s.Go(func() {
					if err := s.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
						mlog.Error(err.Error())
					}
				})
			}
		}
	})

	return configListenerId, licenseListenerId
}

func (s *Server) stopSearchEngine() {
	s.RemoveConfigListener(s.searchConfigListenerId)
	s.RemoveLicenseListener(s.searchLicenseListenerId)
	if s.SearchEngine != nil && s.SearchEngine.ElasticsearchEngine != nil && s.SearchEngine.ElasticsearchEngine.IsActive() {
		s.SearchEngine.ElasticsearchEngine.Stop()
	}
	if s.SearchEngine != nil && s.SearchEngine.BleveEngine != nil && s.SearchEngine.BleveEngine.IsActive() {
		s.SearchEngine.BleveEngine.Stop()
	}
}

func (s *Server) initDiagnostics(endpoint string) {
	if s.diagnosticClient == nil {
		config := analytics.Config{}
		config.Logger = analytics.StdLogger(s.Log.StdLog(mlog.String("source", "segment")))
		// For testing
		if endpoint != "" {
			config.Endpoint = endpoint
			config.Verbose = true
			config.BatchSize = 1
		}
		client, _ := analytics.NewWithConfig(SEGMENT_KEY, config)
		client.Enqueue(analytics.Identify{
			UserId: s.diagnosticId,
		})

		s.diagnosticClient = client
	}
}

func (s *Server) initRudder(endpoint string) {
	if s.rudderClient == nil {
		config := rudder.Config{}
		config.Logger = rudder.StdLogger(s.Log.StdLog(mlog.String("source", "rudder")))
		config.Endpoint = endpoint
		// For testing
		if endpoint != RUDDER_DATAPLANE_URL {
			config.Verbose = true
			config.BatchSize = 1
		}
		client, err := rudder.NewWithConfig(RUDDER_KEY, endpoint, config)
		if err != nil {
			mlog.Error("Failed to create Rudder instance", mlog.Err(err))
			return
		}
		client.Enqueue(rudder.Identify{
			UserId: s.diagnosticId,
		})

		s.rudderClient = client
	}
}

// shutdownDiagnostics closes the diagnostic client.
func (s *Server) shutdownDiagnostics() error {
	var segmentErr, rudderErr error
	if s.diagnosticClient != nil {
		segmentErr = s.diagnosticClient.Close()
	}

	if s.rudderClient != nil {
		rudderErr = s.rudderClient.Close()
	}

	if segmentErr != nil && rudderErr != nil {
		return errors.New(fmt.Sprintf("%s, %s", segmentErr.Error(), rudderErr.Error()))
	} else if segmentErr != nil {
		return segmentErr
	}

	return rudderErr
}

// GetHubs returns the list of hubs. This method is safe
// for concurrent use by multiple goroutines.
func (s *Server) GetHubs() []*Hub {
	s.hubsLock.RLock()
	defer s.hubsLock.RUnlock()
	return s.hubs
}

// getHub gets the element at the given index in the hubs list. This method is safe
// for concurrent use by multiple goroutines.
func (s *Server) GetHub(index int) (*Hub, error) {
	s.hubsLock.RLock()
	defer s.hubsLock.RUnlock()
	if index >= len(s.hubs) {
		return nil, errors.New("Hub element doesn't exist")
	}
	return s.hubs[index], nil
}

// SetHubs sets a new list of hubs. This method is safe
// for concurrent use by multiple goroutines.
func (s *Server) SetHubs(hubs []*Hub) {
	s.hubsLock.Lock()
	defer s.hubsLock.Unlock()
	s.hubs = hubs
}

// SetHub sets the element at the given index in the hubs list. This method is safe
// for concurrent use by multiple goroutines.
func (s *Server) SetHub(index int, hub *Hub) error {
	s.hubsLock.Lock()
	defer s.hubsLock.Unlock()
	if index >= len(s.hubs) {
		return errors.New("Index is greater than the size of the hubs list")
	}
	s.hubs[index] = hub
	return nil
}

func (s *Server) FileBackend() (filesstore.FileBackend, *model.AppError) {
	license := s.License()
	return filesstore.NewFileBackend(&s.Config().FileSettings, license != nil && *license.Features.Compliance)
}

func (s *Server) TotalWebsocketConnections() int {
	count := int64(0)
	for _, hub := range s.GetHubs() {
		count = count + atomic.LoadInt64(&hub.connectionCount)
	}

	return int(count)
}

func (s *Server) ensureDiagnosticId() {
	if s.diagnosticId != "" {
		return
	}
	props, err := s.Store.System().Get()
	if err != nil {
		return
	}

	id := props[model.SYSTEM_DIAGNOSTIC_ID]
	if len(id) == 0 {
		id = model.NewId()
		systemID := &model.System{Name: model.SYSTEM_DIAGNOSTIC_ID, Value: id}
		s.Store.System().Save(systemID)
	}

	s.diagnosticId = id
}
