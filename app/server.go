// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/rs/cors"
	"github.com/throttled/throttled"
	"golang.org/x/crypto/acme/autocert"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/services/httpservice"
	"github.com/mattermost/mattermost-server/services/imageproxy"
	"github.com/mattermost/mattermost-server/services/timezones"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/fileutils"
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

	runjobs bool
	Jobs    *jobs.JobServer

	config                 atomic.Value
	envConfig              map[string]interface{}
	configFile             string
	configListeners        map[string]func(*model.Config, *model.Config)
	clusterLeaderListeners sync.Map

	licenseValue       atomic.Value
	clientLicenseValue atomic.Value
	licenseListeners   map[string]func()

	timezones *timezones.Timezones

	newStore func() store.Store

	htmlTemplateWatcher     *utils.HTMLTemplateWatcher
	sessionCache            *utils.Cache
	seenPendingPostIdsCache *utils.Cache
	configListenerId        string
	licenseListenerId       string
	logListenerId           string
	clusterLeaderListenerId string
	disableConfigWatch      bool
	configWatcher           *config.ConfigWatcher
	asymmetricSigningKey    *ecdsa.PrivateKey

	pluginCommands     []*PluginCommand
	pluginCommandsLock sync.RWMutex

	clientConfig        map[string]string
	clientConfigHash    string
	limitedClientConfig map[string]string
	diagnosticId        string

	phase2PermissionsMigrationComplete bool

	HTTPService httpservice.HTTPService

	ImageProxy *imageproxy.ImageProxy

	Log *mlog.Logger

	joinCluster        bool
	startMetrics       bool
	startElasticsearch bool

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

func NewServer(options ...Option) (*Server, error) {
	rootRouter := mux.NewRouter()

	s := &Server{
		goroutineExitSignal:     make(chan struct{}, 1),
		RootRouter:              rootRouter,
		configFile:              "config.json",
		configListeners:         make(map[string]func(*model.Config, *model.Config)),
		licenseListeners:        map[string]func(){},
		sessionCache:            utils.NewLru(model.SESSION_CACHE_SIZE),
		seenPendingPostIdsCache: utils.NewLru(PENDING_POST_IDS_CACHE_SIZE),
		clientConfig:            make(map[string]string),
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

	s.ImageProxy = imageproxy.MakeImageProxy(s, s.HTTPService)

	if utils.T == nil {
		if err := utils.TranslationsPreInit(); err != nil {
			return nil, errors.Wrapf(err, "unable to load Mattermost translation files")
		}
	}

	err := s.RunOldAppInitalization()
	if err != nil {
		return nil, err
	}

	model.AppErrorInit(utils.T)

	s.timezones = timezones.New("")

	// Start email batching because it's not like the other jobs
	s.InitEmailBatching()
	s.AddConfigListener(func(_, _ *model.Config) {
		s.InitEmailBatching()
	})

	mlog.Info(fmt.Sprintf("Current version is %v (%v/%v/%v/%v)", model.CurrentVersion, model.BuildNumber, model.BuildDate, model.BuildHash, model.BuildHashEnterprise))
	mlog.Info(fmt.Sprintf("Enterprise Enabled: %v", model.BuildEnterpriseReady))
	pwd, _ := os.Getwd()
	mlog.Info(fmt.Sprintf("Current working directory is %v", pwd))
	mlog.Info(fmt.Sprintf("Loaded config file from %v", fileutils.FindConfigFile(s.configFile)))

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

	if s.joinCluster && s.Cluster != nil {
		s.FakeApp().RegisterAllClusterMessageHandlers()
		s.Cluster.StartInterNodeCommunication()
	}

	if s.startMetrics && s.Metrics != nil {
		s.Metrics.StartServer()
	}

	if s.startElasticsearch && s.Elasticsearch != nil {
		s.StartElasticsearch()
	}

	s.initJobs()

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

	return s, nil
}

// Global app opptions that should be applied to apps created by this server
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

	if s.Cluster != nil {
		s.Cluster.StopInterNodeCommunication()
	}

	if s.Metrics != nil {
		s.Metrics.StopServer()
	}

	if s.Jobs != nil && s.runjobs {
		s.Jobs.StopWorkers()
		s.Jobs.StopSchedulers()
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

func (s *Server) Start() error {
	mlog.Info("Starting Server...")

	var handler http.Handler = s.RootRouter
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

		rateLimiter, err := NewRateLimiter(&s.Config().RateLimitSettings)
		if err != nil {
			return err
		}

		s.RateLimiter = rateLimiter
		handler = rateLimiter.RateLimitHandler(handler)
	}

	s.Server = &http.Server{
		Handler:      handlers.RecoveryHandler(handlers.RecoveryLogger(&RecoveryLogger{}), handlers.PrintRecoveryStack(true))(handler),
		ReadTimeout:  time.Duration(*s.Config().ServiceSettings.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(*s.Config().ServiceSettings.WriteTimeout) * time.Second,
		ErrorLog:     s.Log.StdLog(mlog.String("source", "httpserver")),
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

	mlog.Info(fmt.Sprintf("Server is listening on %v", listener.Addr().String()))

	// Migration from old let's encrypt library
	if *s.Config().ServiceSettings.UseLetsEncrypt {
		if stat, err := os.Stat(*s.Config().ServiceSettings.LetsEncryptCertificateCacheFile); err == nil && !stat.IsDir() {
			os.Remove(*s.Config().ServiceSettings.LetsEncryptCertificateCacheFile)
		}
	}

	m := &autocert.Manager{
		Cache:  autocert.DirCache(*s.Config().ServiceSettings.LetsEncryptCertificateCacheFile),
		Prompt: autocert.AcceptTOS,
	}

	if *s.Config().ServiceSettings.Forward80To443 {
		if host, port, err := net.SplitHostPort(addr); err != nil {
			mlog.Error("Unable to setup forwarding: " + err.Error())
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
						mlog.Error("Unable to setup forwarding: " + err.Error())
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
			mlog.Critical(fmt.Sprintf("Error starting server, err:%v", err))
			time.Sleep(time.Second)
		}

		close(s.didFinishListen)
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

func runSecurityJob(s *Server) {
	doSecurity(s)
	model.CreateRecurringTask("Security", func() {
		doSecurity(s)
	}, time.Hour*4)
}

func runDiagnosticsJob(s *Server) {
	doDiagnostics(s)
	model.CreateRecurringTask("Diagnostics", func() {
		doDiagnostics(s)
	}, time.Hour*24)
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

func doSecurity(s *Server) {
	s.DoSecurityUpdateCheck()
}

func doDiagnostics(s *Server) {
	if *s.Config().LogSettings.EnableDiagnostics {
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

func (s *Server) StartElasticsearch() {
	s.Go(func() {
		if err := s.Elasticsearch.Start(); err != nil {
			s.Log.Error(err.Error())
		}
	})

	s.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if !*oldConfig.ElasticsearchSettings.EnableIndexing && *newConfig.ElasticsearchSettings.EnableIndexing {
			s.Go(func() {
				if err := s.Elasticsearch.Start(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else if *oldConfig.ElasticsearchSettings.EnableIndexing && !*newConfig.ElasticsearchSettings.EnableIndexing {
			s.Go(func() {
				if err := s.Elasticsearch.Stop(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else if *oldConfig.ElasticsearchSettings.Password != *newConfig.ElasticsearchSettings.Password || *oldConfig.ElasticsearchSettings.Username != *newConfig.ElasticsearchSettings.Username || *oldConfig.ElasticsearchSettings.ConnectionUrl != *newConfig.ElasticsearchSettings.ConnectionUrl || *oldConfig.ElasticsearchSettings.Sniff != *newConfig.ElasticsearchSettings.Sniff {
			s.Go(func() {
				if *oldConfig.ElasticsearchSettings.EnableIndexing {
					if err := s.Elasticsearch.Stop(); err != nil {
						mlog.Error(err.Error())
					}
					if err := s.Elasticsearch.Start(); err != nil {
						mlog.Error(err.Error())
					}
				}
			})
		}
	})

	s.AddLicenseListener(func() {
		if s.License() != nil {
			s.Go(func() {
				if err := s.Elasticsearch.Start(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else {
			s.Go(func() {
				if err := s.Elasticsearch.Stop(); err != nil {
					mlog.Error(err.Error())
				}
			})
		}
	})
}
