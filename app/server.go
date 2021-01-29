// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"crypto/tls"
	"fmt"
	"hash/maphash"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/rs/cors"
	"golang.org/x/crypto/acme/autocert"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/services/awsmeter"
	"github.com/mattermost/mattermost-server/v5/services/cache"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
	"github.com/mattermost/mattermost-server/v5/services/imageproxy"
	"github.com/mattermost/mattermost-server/v5/services/mailservice"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/services/searchengine/bleveengine"
	"github.com/mattermost/mattermost-server/v5/services/telemetry"
	"github.com/mattermost/mattermost-server/v5/services/timezones"
	"github.com/mattermost/mattermost-server/v5/services/tracing"
	"github.com/mattermost/mattermost-server/v5/services/upgrader"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v5/store/retrylayer"
	"github.com/mattermost/mattermost-server/v5/store/searchlayer"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/store/timerlayer"
	"github.com/mattermost/mattermost-server/v5/utils"
)

var MaxNotificationsPerChannelDefault int64 = 1000000

// declaring this as var to allow overriding in tests
var SentryDSN = "placeholder_sentry_dsn"

type Server struct {
	sqlStore           *sqlstore.SqlStore
	Store              store.Store
	WebSocketRouter    *WebSocketRouter
	AppInitializedOnce sync.Once

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

	EmailService *EmailService

	hubs     []*Hub
	hashSeed maphash.Seed

	PushNotificationsHub   PushNotificationsHub
	pushNotificationClient *http.Client // TODO: move this to it's own package

	runjobs bool
	Jobs    *jobs.JobServer

	clusterLeaderListeners sync.Map

	licenseValue       atomic.Value
	clientLicenseValue atomic.Value
	licenseListeners   map[string]func(*model.License, *model.License)

	timezones *timezones.Timezones

	newStore func() (store.Store, error)

	htmlTemplateWatcher     *utils.HTMLTemplateWatcher
	sessionCache            cache.Cache
	seenPendingPostIdsCache cache.Cache
	statusCache             cache.Cache
	configListenerId        string
	licenseListenerId       string
	logListenerId           string
	clusterLeaderListenerId string
	searchConfigListenerId  string
	searchLicenseListenerId string
	loggerLicenseListenerId string
	configStore             *config.Store
	postActionCookieSecret  []byte

	advancedLogListenerCleanup func()

	pluginCommands     []*PluginCommand
	pluginCommandsLock sync.RWMutex

	asymmetricSigningKey atomic.Value
	clientConfig         atomic.Value
	clientConfigHash     atomic.Value
	limitedClientConfig  atomic.Value

	telemetryService *telemetry.TelemetryService

	phase2PermissionsMigrationComplete bool

	HTTPService httpservice.HTTPService

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
	Cloud            einterfaces.CloudInterface
	Metrics          einterfaces.MetricsInterface
	Notification     einterfaces.NotificationInterface
	Saml             einterfaces.SamlInterface

	CacheProvider cache.Provider

	tracer *tracing.Tracer

	// These are used to prevent concurrent upload requests
	// for a given upload session which could cause inconsistencies
	// and data corruption.
	uploadLockMapMut sync.Mutex
	uploadLockMap    map[string]bool

	featureFlagSynchronizer      *config.FeatureFlagSynchronizer
	featureFlagStop              chan struct{}
	featureFlagStopped           chan struct{}
	featureFlagSynchronizerMutex sync.Mutex
}

func NewServer(options ...Option) (*Server, error) {
	rootRouter := mux.NewRouter()
	localRouter := mux.NewRouter()

	s := &Server{
		goroutineExitSignal: make(chan struct{}, 1),
		RootRouter:          rootRouter,
		LocalRouter:         localRouter,
		licenseListeners:    map[string]func(*model.License, *model.License){},
		hashSeed:            maphash.MakeSeed(),
		uploadLockMap:       map[string]bool{},
	}

	for _, option := range options {
		if err := option(s); err != nil {
			return nil, errors.Wrap(err, "failed to apply option")
		}
	}

	if s.configStore == nil {
		innerStore, err := config.NewFileStore("config.json", true)
		if err != nil {
			return nil, errors.Wrap(err, "failed to load config")
		}
		configStore, err := config.NewStoreFromBacking(innerStore, nil, false)
		if err != nil {
			return nil, errors.Wrap(err, "failed to load config")
		}

		s.configStore = configStore
	}

	if err := s.initLogging(); err != nil {
		mlog.Error("Could not initiate logging", mlog.Err(err))
	}

	// This is called after initLogging() to avoid a race condition.
	mlog.Info("Server is initializing...", mlog.String("go_version", runtime.Version()))

	// It is important to initialize the hub only after the global logger is set
	// to avoid race conditions while logging from inside the hub.
	fakeApp := New(ServerConnector(s))
	fakeApp.HubStart()

	if *s.Config().LogSettings.EnableDiagnostics && *s.Config().LogSettings.EnableSentry {
		if strings.Contains(SentryDSN, "placeholder") {
			mlog.Warn("Sentry reporting is enabled, but SENTRY_DSN is not set. Disabling reporting.")
		} else {
			if err := sentry.Init(sentry.ClientOptions{
				Dsn:              SentryDSN,
				Release:          model.BuildHash,
				AttachStacktrace: true,
				BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
					// sanitize data sent to sentry to reduce exposure of PII
					if event.Request != nil {
						event.Request.Cookies = ""
						event.Request.QueryString = ""
						event.Request.Headers = nil
						event.Request.Data = ""
					}
					return event
				},
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

	s.HTTPService = httpservice.MakeHTTPService(s)
	s.pushNotificationClient = s.HTTPService.MakeClient(true)

	s.ImageProxy = imageproxy.MakeImageProxy(s, s.HTTPService, s.Log)

	if err := utils.TranslationsPreInit(); err != nil {
		return nil, errors.Wrapf(err, "unable to load Mattermost translation files")
	}
	model.AppErrorInit(utils.T)

	searchEngine := searchengine.NewBroker(s.Config(), s.Jobs)
	bleveEngine := bleveengine.NewBleveEngine(s.Config(), s.Jobs)
	if err := bleveEngine.Start(); err != nil {
		return nil, err
	}
	searchEngine.RegisterBleveEngine(bleveEngine)
	s.SearchEngine = searchEngine

	// at the moment we only have this implementation
	// in the future the cache provider will be built based on the loaded config
	s.CacheProvider = cache.NewProvider()
	if err := s.CacheProvider.Connect(); err != nil {
		return nil, errors.Wrapf(err, "Unable to connect to cache provider")
	}

	var err error
	if s.sessionCache, err = s.CacheProvider.NewCache(&cache.CacheOptions{
		Size:           model.SESSION_CACHE_SIZE,
		Striped:        true,
		StripedBuckets: maxInt(runtime.NumCPU()-1, 1),
	}); err != nil {
		return nil, errors.Wrap(err, "Unable to create session cache")
	}
	if s.seenPendingPostIdsCache, err = s.CacheProvider.NewCache(&cache.CacheOptions{
		Size: PendingPostIDsCacheSize,
	}); err != nil {
		return nil, errors.Wrap(err, "Unable to create pending post ids cache")
	}
	if s.statusCache, err = s.CacheProvider.NewCache(&cache.CacheOptions{
		Size:           model.STATUS_CACHE_SIZE,
		Striped:        true,
		StripedBuckets: maxInt(runtime.NumCPU()-1, 1),
	}); err != nil {
		return nil, errors.Wrap(err, "Unable to create status cache")
	}

	s.createPushNotificationsHub()

	if err2 := utils.InitTranslations(s.Config().LocalizationSettings); err2 != nil {
		return nil, errors.Wrapf(err2, "unable to load Mattermost translation files")
	}

	s.initEnterprise()

	if s.newStore == nil {
		s.newStore = func() (store.Store, error) {
			s.sqlStore = sqlstore.New(s.Config().SqlSettings, s.Metrics)
			if s.sqlStore.DriverName() == model.DATABASE_DRIVER_POSTGRES {
				ver, err2 := s.sqlStore.GetDbVersion(true)
				if err2 != nil {
					return nil, errors.Wrap(err2, "cannot get DB version")
				}
				intVer, err2 := strconv.Atoi(ver)
				if err2 != nil {
					return nil, errors.Wrap(err2, "cannot parse DB version")
				}
				if intVer < sqlstore.MinimumRequiredPostgresVersion {
					return nil, fmt.Errorf("minimum required postgres version is %s; found %s", sqlstore.VersionString(sqlstore.MinimumRequiredPostgresVersion), sqlstore.VersionString(intVer))
				}
			}

			lcl, err2 := localcachelayer.NewLocalCacheLayer(
				retrylayer.New(s.sqlStore),
				s.Metrics,
				s.Cluster,
				s.CacheProvider,
			)
			if err2 != nil {
				return nil, errors.Wrap(err2, "cannot create local cache layer")
			}

			searchStore := searchlayer.NewSearchLayer(
				lcl,
				s.SearchEngine,
				s.Config(),
			)

			s.AddConfigListener(func(prevCfg, cfg *model.Config) {
				searchStore.UpdateConfig(cfg)
			})

			s.sqlStore.UpdateLicense(s.License())
			s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
				s.sqlStore.UpdateLicense(newLicense)
			})

			return timerlayer.New(
				searchStore,
				s.Metrics,
			), nil
		}
	}

	if htmlTemplateWatcher, err2 := utils.NewHTMLTemplateWatcher("templates"); err2 != nil {
		mlog.Error("Failed to parse server templates", mlog.Err(err2))
	} else {
		s.htmlTemplateWatcher = htmlTemplateWatcher
	}

	s.Store, err = s.newStore()
	if err != nil {
		return nil, errors.Wrap(err, "cannot create store")
	}

	s.configListenerId = s.AddConfigListener(func(_, _ *model.Config) {
		s.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CONFIG_CHANGED, "", "", "", nil)

		message.Add("config", s.ClientConfigWithComputed())
		s.Go(func() {
			s.Publish(message)
		})
	})
	s.licenseListenerId = s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		s.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LICENSE_CHANGED, "", "", "", nil)
		message.Add("license", s.GetSanitizedClientLicense())
		s.Go(func() {
			s.Publish(message)
		})

	})

	s.telemetryService = telemetry.New(s, s.Store, s.SearchEngine, s.Log)

	emailService, err := NewEmailService(s)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to initialize email service")
	}
	s.EmailService = emailService

	if model.BuildEnterpriseReady == "true" {
		s.LoadLicense()
	}

	s.setupFeatureFlags()

	s.initJobs()

	s.clusterLeaderListenerId = s.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if job schedulers should be running:", mlog.Bool("isLeader", s.IsLeader()))
		if s.Jobs != nil && s.Jobs.Schedulers != nil {
			s.Jobs.Schedulers.HandleClusterLeaderChange(s.IsLeader())
		}
		s.setupFeatureFlags()
	})

	if s.joinCluster && s.Cluster != nil {
		s.Cluster.StartInterNodeCommunication()
	}

	if err = s.ensureAsymmetricSigningKey(); err != nil {
		return nil, errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}

	if err = s.ensurePostActionCookieSecret(); err != nil {
		return nil, errors.Wrapf(err, "unable to ensure PostAction cookie secret")
	}

	if err = s.ensureInstallationDate(); err != nil {
		return nil, errors.Wrapf(err, "unable to ensure installation date")
	}

	if err = s.ensureFirstServerRunTimestamp(); err != nil {
		return nil, errors.Wrapf(err, "unable to ensure first run timestamp")
	}

	s.regenerateClientConfig()

	subpath, err := utils.GetSubpathFromConfig(s.Config())
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse SiteURL subpath")
	}
	s.Router = s.RootRouter.PathPrefix(subpath).Subrouter()

	// FakeApp: remove this when we have the ServePluginRequest and ServePluginPublicRequest migrated in the server
	pluginsRoute := s.Router.PathPrefix("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	pluginsRoute.HandleFunc("", fakeApp.ServePluginRequest)
	pluginsRoute.HandleFunc("/public/{public_file:.*}", fakeApp.ServePluginPublicRequest)
	pluginsRoute.HandleFunc("/{anything:.*}", fakeApp.ServePluginRequest)

	// If configured with a subpath, redirect 404s at the root back into the subpath.
	if subpath != "/" {
		s.RootRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = path.Join(subpath, r.URL.Path)
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		})
	}

	s.WebSocketRouter = &WebSocketRouter{
		server:   s,
		handlers: make(map[string]webSocketHandler),
	}
	s.WebSocketRouter.app = fakeApp

	if appErr := mailservice.TestConnection(s.Config()); appErr != nil {
		mlog.Error("Mail server connection test is failed: " + appErr.Message)
	}

	if _, err = url.ParseRequestURI(*s.Config().ServiceSettings.SiteURL); err != nil {
		mlog.Error("SiteURL must be set. Some features will operate incorrectly if the SiteURL is not set. See documentation for details: http://about.mattermost.com/default-site-url")
	}

	backend, appErr := s.FileBackend()
	if appErr != nil {
		mlog.Error("Problem with file storage settings", mlog.Err(appErr))
	} else {
		nErr := backend.TestConnection()
		if nErr != nil {
			mlog.Error("Problem with file storage settings", mlog.Err(nErr))
		}
	}

	s.timezones = timezones.New()
	// Start email batching because it's not like the other jobs
	s.AddConfigListener(func(_, _ *model.Config) {
		s.EmailService.InitEmailBatching()
	})

	// Start plugin health check job
	pluginsEnvironment := s.PluginsEnvironment
	if pluginsEnvironment != nil {
		pluginsEnvironment.InitPluginHealthCheckJob(*s.Config().PluginSettings.Enable && *s.Config().PluginSettings.EnableHealthCheck)
	}
	s.AddConfigListener(func(_, c *model.Config) {
		s.PluginsLock.RLock()
		pluginsEnvironment := s.PluginsEnvironment
		s.PluginsLock.RUnlock()
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

	allowAdvancedLogging := license != nil && *license.Features.AdvancedLogging

	if s.Audit == nil {
		s.Audit = &audit.Audit{}
		s.Audit.Init(audit.DefMaxQueueSize)
		if err = s.configureAudit(s.Audit, allowAdvancedLogging); err != nil {
			mlog.Error("Error configuring audit", mlog.Err(err))
		}
	}

	s.removeUnlicensedLogTargets(license)
	s.enableLoggingMetrics()

	s.loggerLicenseListenerId = s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		s.removeUnlicensedLogTargets(newLicense)
		s.enableLoggingMetrics()
	})

	// Enable developer settings if this is a "dev" build
	if model.BuildNumber == "dev" {
		s.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })
	}

	if err = s.Store.Status().ResetAll(); err != nil {
		mlog.Error("Error to reset the server status.", mlog.Err(err))
	}

	if s.startMetrics && s.Metrics != nil {
		s.Metrics.StartServer()
	}

	s.SearchEngine.UpdateConfig(s.Config())
	searchConfigListenerId, searchLicenseListenerId := s.StartSearchEngine()
	s.searchConfigListenerId = searchConfigListenerId
	s.searchLicenseListenerId = searchLicenseListenerId

	// if enabled - perform initial product notices fetch
	if *s.Config().AnnouncementSettings.AdminNoticesEnabled || *s.Config().AnnouncementSettings.UserNoticesEnabled {
		go fakeApp.UpdateProductNotices()
	}

	return s, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (s *Server) RunJobs() {
	if s.runjobs {
		s.Go(func() {
			runSecurityJob(s)
		})
		s.Go(func() {
			firstRun, err := s.getFirstServerRunTimestamp()
			if err != nil {
				mlog.Warn("Fetching time of first server run failed. Setting to 'now'.")
				s.ensureFirstServerRunTimestamp()
				firstRun = utils.MillisFromTime(time.Now())
			}
			s.telemetryService.RunTelemetryJob(firstRun)
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

		if *s.Config().ServiceSettings.EnableAWSMetering {
			runReportToAWSMeterJob(s)
		}
	}
}

// Global app options that should be applied to apps created by this server
func (s *Server) AppOptions() []AppOption {
	return []AppOption{
		ServerConnector(s),
	}
}

// initLogging initializes and configures the logger. This may be called more than once.
func (s *Server) initLogging() error {
	if s.Log == nil {
		s.Log = mlog.NewLogger(utils.MloggerConfigFromLoggerConfig(&s.Config().LogSettings, utils.GetLogFileLocation))
	}

	// Use this app logger as the global logger (eventually remove all instances of global logging).
	// This is deferred because a copy is made of the logger and it must be fully configured before
	// the copy is made.
	defer mlog.InitGlobalLogger(s.Log)

	// Redirect default Go logger to this logger.
	defer mlog.RedirectStdLog(s.Log)

	if s.NotificationsLog == nil {
		notificationLogSettings := utils.GetLogSettingsFromNotificationsLogSettings(&s.Config().NotificationLogSettings)
		s.NotificationsLog = mlog.NewLogger(utils.MloggerConfigFromLoggerConfig(notificationLogSettings, utils.GetNotificationsLogFileLocation)).
			WithCallerSkip(1).With(mlog.String("logSource", "notifications"))
	}

	if s.logListenerId != "" {
		s.RemoveConfigListener(s.logListenerId)
	}
	s.logListenerId = s.AddConfigListener(func(_, after *model.Config) {
		s.Log.ChangeLevels(utils.MloggerConfigFromLoggerConfig(&after.LogSettings, utils.GetLogFileLocation))

		notificationLogSettings := utils.GetLogSettingsFromNotificationsLogSettings(&after.NotificationLogSettings)
		s.NotificationsLog.ChangeLevels(utils.MloggerConfigFromLoggerConfig(notificationLogSettings, utils.GetNotificationsLogFileLocation))
	})

	// Configure advanced logging.
	// Advanced logging is E20 only, however logging must be initialized before the license
	// file is loaded.  If no valid E20 license exists then advanced logging will be
	// shutdown once license is loaded/checked.
	if *s.Config().LogSettings.AdvancedLoggingConfig != "" {
		dsn := *s.Config().LogSettings.AdvancedLoggingConfig
		isJson := config.IsJsonMap(dsn)

		// If this is a file based config we need the full path so it can be watched.
		if !isJson && strings.HasPrefix(s.configStore.String(), "file://") && !filepath.IsAbs(dsn) {
			configPath := strings.TrimPrefix(s.configStore.String(), "file://")
			dsn = filepath.Join(filepath.Dir(configPath), dsn)
		}

		cfg, err := config.NewLogConfigSrc(dsn, isJson, s.configStore)
		if err != nil {
			return fmt.Errorf("invalid advanced logging config, %w", err)
		}

		if err := s.Log.ConfigAdvancedLogging(cfg.Get()); err != nil {
			return fmt.Errorf("error configuring advanced logging, %w", err)
		}

		if !isJson {
			mlog.Info("Loaded advanced logging config", mlog.String("source", dsn))
		}

		listenerId := cfg.AddListener(func(_, newCfg mlog.LogTargetCfg) {
			if err := s.Log.ConfigAdvancedLogging(newCfg); err != nil {
				mlog.Error("Error re-configuring advanced logging", mlog.Err(err))
			} else {
				mlog.Info("Re-configured advanced logging")
			}
		})

		// In case initLogging is called more than once.
		if s.advancedLogListenerCleanup != nil {
			s.advancedLogListenerCleanup()
		}

		s.advancedLogListenerCleanup = func() {
			cfg.RemoveListener(listenerId)
		}
	}
	return nil
}

func (s *Server) removeUnlicensedLogTargets(license *model.License) {
	if license != nil && *license.Features.AdvancedLogging {
		// advanced logging enabled via license; no need to remove any targets
		return
	}

	timeoutCtx, cancelCtx := context.WithTimeout(context.Background(), time.Second*10)
	defer cancelCtx()

	mlog.RemoveTargets(timeoutCtx, func(ti mlog.TargetInfo) bool {
		return ti.Type != "*target.Writer" && ti.Type != "*target.File"
	})
}

func (s *Server) enableLoggingMetrics() {
	if s.Metrics == nil {
		return
	}

	if err := mlog.EnableMetrics(s.Metrics.GetLoggerMetricsCollector()); err != nil {
		mlog.Error("Failed to enable advanced logging metrics", mlog.Err(err))
	} else {
		mlog.Debug("Advanced logging metrics enabled")
	}
}

const TimeToWaitForConnectionsToCloseOnServerShutdown = time.Second

func (s *Server) StopHTTPServer() {
	if s.Server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), TimeToWaitForConnectionsToCloseOnServerShutdown)
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

func (s *Server) Shutdown() {
	mlog.Info("Stopping Server...")

	defer sentry.Flush(2 * time.Second)

	s.HubStop()
	s.ShutDownPlugins()
	s.RemoveLicenseListener(s.licenseListenerId)
	s.RemoveLicenseListener(s.loggerLicenseListenerId)
	s.RemoveClusterLeaderChangedListener(s.clusterLeaderListenerId)

	if s.tracer != nil {
		if err := s.tracer.Close(); err != nil {
			mlog.Warn("Unable to cleanly shutdown opentracing client", mlog.Err(err))
		}
	}

	err := s.telemetryService.Shutdown()
	if err != nil {
		mlog.Warn("Unable to cleanly shutdown telemetry client", mlog.Err(err))
	}

	s.StopHTTPServer()
	s.stopLocalModeServer()
	// Push notification hub needs to be shutdown after HTTP server
	// to prevent stray requests from generating a push notification after it's shut down.
	s.StopPushNotificationsHubWorkers()

	s.WaitForGoroutines()

	if s.htmlTemplateWatcher != nil {
		s.htmlTemplateWatcher.Close()
	}

	if s.advancedLogListenerCleanup != nil {
		s.advancedLogListenerCleanup()
		s.advancedLogListenerCleanup = nil
	}

	s.RemoveConfigListener(s.configListenerId)
	s.RemoveConfigListener(s.logListenerId)
	s.stopSearchEngine()

	s.Audit.Shutdown()

	s.stopFeatureFlagUpdateJob()

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
		if err = s.CacheProvider.Close(); err != nil {
			mlog.Warn("Unable to cleanly shutdown cache", mlog.Err(err))
		}
	}

	timeoutCtx, timeoutCancel := context.WithTimeout(context.Background(), time.Second*15)
	defer timeoutCancel()
	if err := mlog.Flush(timeoutCtx); err != nil {
		mlog.Warn("Error flushing logs", mlog.Err(err))
	}

	mlog.Info("Server stopped")

	// this should just write the "server stopped" record, the rest are already flushed.
	timeoutCtx2, timeoutCancel2 := context.WithTimeout(context.Background(), time.Second*5)
	defer timeoutCancel2()
	_ = mlog.ShutdownAdvancedLogging(timeoutCtx2)
}

func (s *Server) Restart() error {
	percentage, err := s.UpgradeToE0Status()
	if err != nil || percentage != 100 {
		return errors.Wrap(err, "unable to restart because the system has not been upgraded")
	}
	s.Shutdown()

	argv0, err := exec.LookPath(os.Args[0])
	if err != nil {
		return err
	}

	if _, err = os.Stat(argv0); err != nil {
		return err
	}

	mlog.Info("Restarting server")
	return syscall.Exec(argv0, os.Args, os.Environ())
}

func (s *Server) isUpgradedFromTE() bool {
	val, err := s.Store.System().GetByName(model.SYSTEM_UPGRADED_FROM_TE_ID)
	if err != nil {
		return false
	}
	return val.Value == "true"
}

func (s *Server) CanIUpgradeToE0() error {
	return upgrader.CanIUpgradeToE0()
}

func (s *Server) UpgradeToE0() error {
	if err := upgrader.UpgradeToE0(); err != nil {
		return err
	}
	upgradedFromTE := &model.System{Name: model.SYSTEM_UPGRADED_FROM_TE_ID, Value: "true"}
	s.Store.System().Save(upgradedFromTE)
	return nil
}

func (s *Server) UpgradeToE0Status() (int64, error) {
	return upgrader.UpgradeToE0Status()
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

	if *s.Config().LogSettings.EnableDiagnostics && *s.Config().LogSettings.EnableSentry && !strings.Contains(SentryDSN, "placeholder") {
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
		return errors.Wrapf(err, utils.T("api.server.start_server.starting.critical"), err)
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

func runLicenseExpirationCheckJob(a *App) {
	doLicenseExpirationCheck(a)
	model.CreateRecurringTask("License Expiration Check", func() {
		doLicenseExpirationCheck(a)
	}, time.Hour*24)
}

func runReportToAWSMeterJob(s *Server) {
	model.CreateRecurringTask("Collect and send usage report to AWS Metering Service", func() {
		doReportUsageToAWSMeteringService(s)
	}, time.Hour*model.AWS_METERING_REPORT_INTERVAL)
}

func doReportUsageToAWSMeteringService(s *Server) {
	awsMeter := awsmeter.New(s.Store, s.Config())
	if awsMeter == nil {
		mlog.Error("Cannot obtain instance of AWS Metering Service.")
		return
	}

	dimensions := []string{model.AWS_METERING_DIMENSION_USAGE_HRS}
	reports := awsMeter.GetUserCategoryUsage(dimensions, time.Now().UTC(), time.Now().Add(-model.AWS_METERING_REPORT_INTERVAL*time.Hour).UTC())
	awsMeter.ReportUserCategoryUsage(reports)
}

func runCheckWarnMetricStatusJob(a *App) {
	doCheckWarnMetricStatus(a)
	model.CreateRecurringTask("Check Warn Metric Status Job", func() {
		doCheckWarnMetricStatus(a)
	}, time.Hour*model.WARN_METRIC_JOB_INTERVAL)
}

func doSecurity(s *Server) {
	s.DoSecurityUpdateCheck()
}

func doTokenCleanup(s *Server) {
	s.Store.Token().Cleanup()
}

func doCommandWebhookCleanup(s *Server) {
	s.Store.CommandWebhook().Cleanup()
}

const (
	SessionsCleanupBatchSize = 1000
)

func doSessionCleanup(s *Server) {
	s.Store.Session().Cleanup(model.GetMillis(), SessionsCleanupBatchSize)
}

func doCheckWarnMetricStatus(a *App) {
	license := a.Srv().License()
	if license != nil {
		mlog.Debug("License is present, skip")
		return
	}

	// Get the system fields values from store
	systemDataList, nErr := a.Srv().Store.System().Get()
	if nErr != nil {
		mlog.Error("No system properties obtained", mlog.Err(nErr))
		return
	}

	warnMetricStatusFromStore := make(map[string]string)

	for key, value := range systemDataList {
		if strings.HasPrefix(key, model.WARN_METRIC_STATUS_STORE_PREFIX) {
			if _, ok := model.WarnMetricsTable[key]; ok {
				warnMetricStatusFromStore[key] = value
				if value == model.WARN_METRIC_STATUS_ACK {
					// If any warn metric has already been acked, we return
					mlog.Debug("Warn metrics have been acked, skip")
					return
				}
			}
		}
	}

	lastWarnMetricRunTimestamp, err := a.Srv().getLastWarnMetricTimestamp()
	if err != nil {
		mlog.Debug("Cannot obtain last advisory run timestamp", mlog.Err(err))
	} else {
		currentTime := utils.MillisFromTime(time.Now())
		// If the admin advisory has already been shown in the last 7 days
		if (currentTime-lastWarnMetricRunTimestamp)/(model.WARN_METRIC_JOB_WAIT_TIME) < 1 {
			mlog.Debug("No advisories should be shown during the wait interval time")
			return
		}
	}

	numberOfActiveUsers, err0 := a.Srv().Store.User().Count(model.UserCountOptions{})
	if err0 != nil {
		mlog.Debug("Error attempting to get active registered users.", mlog.Err(err0))
	}

	teamCount, err1 := a.Srv().Store.Team().AnalyticsTeamCount(false)
	if err1 != nil {
		mlog.Debug("Error attempting to get number of teams.", mlog.Err(err1))
	}

	openChannelCount, err2 := a.Srv().Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN)
	if err2 != nil {
		mlog.Debug("Error attempting to get number of public channels.", mlog.Err(err2))
	}

	// If an account is created with a different email domain
	// Search for an entry that has an email account different from the current domain
	// Get domain account from site url
	localDomainAccount := utils.GetHostnameFromSiteURL(*a.Srv().Config().ServiceSettings.SiteURL)
	isDiffEmailAccount, err3 := a.Srv().Store.User().AnalyticsGetExternalUsers(localDomainAccount)
	if err3 != nil {
		mlog.Debug("Error attempting to get number of private channels.", mlog.Err(err3))
	}

	warnMetrics := []model.WarnMetric{}

	if numberOfActiveUsers < model.WARN_METRIC_NUMBER_OF_ACTIVE_USERS_25 {
		return
	} else if teamCount >= model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_TEAMS_5].Limit && warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_NUMBER_OF_TEAMS_5] != model.WARN_METRIC_STATUS_RUNONCE {
		warnMetrics = append(warnMetrics, model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_TEAMS_5])
	} else if *a.Config().ServiceSettings.EnableMultifactorAuthentication && warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_MFA] != model.WARN_METRIC_STATUS_RUNONCE {
		warnMetrics = append(warnMetrics, model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_MFA])
	} else if isDiffEmailAccount && warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_EMAIL_DOMAIN] != model.WARN_METRIC_STATUS_RUNONCE {
		warnMetrics = append(warnMetrics, model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_EMAIL_DOMAIN])
	} else if openChannelCount >= model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_CHANNELS_50].Limit && warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_NUMBER_OF_CHANNELS_50] != model.WARN_METRIC_STATUS_RUNONCE {
		warnMetrics = append(warnMetrics, model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_CHANNELS_50])
	}

	// If the system did not cross any of the thresholds for the Contextual Advisories
	if len(warnMetrics) == 0 {
		if numberOfActiveUsers >= model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_100].Limit && numberOfActiveUsers < model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200].Limit && warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_100] != model.WARN_METRIC_STATUS_RUNONCE {
			warnMetrics = append(warnMetrics, model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_100])
		} else if numberOfActiveUsers >= model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200].Limit && numberOfActiveUsers < model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300].Limit && warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200] != model.WARN_METRIC_STATUS_RUNONCE {
			warnMetrics = append(warnMetrics, model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200])
		} else if numberOfActiveUsers >= model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300].Limit && numberOfActiveUsers < model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500].Limit && warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300] != model.WARN_METRIC_STATUS_RUNONCE {
			warnMetrics = append(warnMetrics, model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300])
		} else if numberOfActiveUsers >= model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500].Limit {
			var tWarnMetric model.WarnMetric

			if warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500] != model.WARN_METRIC_STATUS_RUNONCE {
				tWarnMetric = model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500]
			}

			postsCount, err4 := a.Srv().Store.Post().AnalyticsPostCount("", false, false)
			if err4 != nil {
				mlog.Debug("Error attempting to get number of posts.", mlog.Err(err4))
			}

			if postsCount > model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M].Limit && warnMetricStatusFromStore[model.SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M] != model.WARN_METRIC_STATUS_RUNONCE {
				tWarnMetric = model.WarnMetricsTable[model.SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M]
			}

			if tWarnMetric != (model.WarnMetric{}) {
				warnMetrics = append(warnMetrics, tWarnMetric)
			}
		}
	}

	isE0Edition := model.BuildEnterpriseReady == "true" // license == nil was already validated upstream

	for _, warnMetric := range warnMetrics {
		data, nErr := a.Srv().Store.System().GetByName(warnMetric.Id)
		if nErr == nil && data != nil && warnMetric.IsBotOnly && data.Value == model.WARN_METRIC_STATUS_RUNONCE {
			mlog.Debug("This metric warning is bot only and ran once")
			continue
		}

		warnMetricStatus, _ := a.getWarnMetricStatusAndDisplayTextsForId(warnMetric.Id, nil, isE0Edition)
		if !warnMetric.IsBotOnly {
			// Banner and bot metric types - send websocket event every interval
			message := model.NewWebSocketEvent(model.WEBSOCKET_WARN_METRIC_STATUS_RECEIVED, "", "", "", nil)
			message.Add("warnMetricStatus", warnMetricStatus.ToJson())
			a.Publish(message)

			// Banner and bot metric types, send the bot message only once
			if data != nil && data.Value == model.WARN_METRIC_STATUS_RUNONCE {
				continue
			}
		}

		if nerr := a.notifyAdminsOfWarnMetricStatus(warnMetric.Id, isE0Edition); nerr != nil {
			mlog.Error("Failed to send notifications to admin users.", mlog.Err(nerr))
		}

		if warnMetric.IsRunOnce {
			a.setWarnMetricsStatusForId(warnMetric.Id, model.WARN_METRIC_STATUS_RUNONCE)
		} else {
			a.setWarnMetricsStatusForId(warnMetric.Id, model.WARN_METRIC_STATUS_LIMIT_REACHED)
		}
	}
}

func doLicenseExpirationCheck(a *App) {
	a.Srv().LoadLicense()
	license := a.Srv().License()

	if license == nil {
		mlog.Debug("License cannot be found.")
		return
	}

	if !license.IsPastGracePeriod() {
		mlog.Debug("License is not past the grace period.")
		return
	}

	users, err := a.Srv().Store.User().GetSystemAdminProfiles()
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
		a.Srv().Go(func() {
			if err := a.Srv().EmailService.SendRemoveExpiredLicenseEmail(user.Email, user.Locale, *a.Config().ServiceSettings.SiteURL); err != nil {
				mlog.Error("Error while sending the license expired email.", mlog.String("user_email", user.Email), mlog.Err(err))
			}
		})
	}

	//remove the license
	a.Srv().RemoveLicense()
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

func (s *Server) FileBackend() (filesstore.FileBackend, *model.AppError) {
	license := s.License()
	backend, err := filesstore.NewFileBackend(&s.Config().FileSettings, license != nil && *license.Features.Compliance)
	if err != nil {
		return nil, model.NewAppError("FileBackend", "api.file.no_driver.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return backend, nil
}

func (s *Server) TotalWebsocketConnections() int {
	// This method is only called after the hub is initialized.
	// Therefore, no mutex is needed to protect s.hubs.
	count := int64(0)
	for _, hub := range s.hubs {
		count = count + atomic.LoadInt64(&hub.connectionCount)
	}

	return int(count)
}

func (s *Server) ClusterHealthScore() int {
	return s.Cluster.HealthScore()
}

func (s *Server) configOrLicenseListener() {
	s.regenerateClientConfig()
}

func (s *Server) ClientConfigHash() string {
	return s.clientConfigHash.Load().(string)
}

func (s *Server) initJobs() {
	s.Jobs = jobs.NewJobServer(s, s.Store, s.Metrics)
	if jobsDataRetentionJobInterface != nil {
		s.Jobs.DataRetentionJob = jobsDataRetentionJobInterface(s)
	}
	if jobsMessageExportJobInterface != nil {
		s.Jobs.MessageExportJob = jobsMessageExportJobInterface(s)
	}
	if jobsElasticsearchAggregatorInterface != nil {
		s.Jobs.ElasticsearchAggregator = jobsElasticsearchAggregatorInterface(s)
	}
	if jobsElasticsearchIndexerInterface != nil {
		s.Jobs.ElasticsearchIndexer = jobsElasticsearchIndexerInterface(s)
	}
	if jobsBleveIndexerInterface != nil {
		s.Jobs.BleveIndexer = jobsBleveIndexerInterface(s)
	}
	if jobsMigrationsInterface != nil {
		s.Jobs.Migrations = jobsMigrationsInterface(s)
	}
}

func (s *Server) TelemetryId() string {
	if s.telemetryService == nil {
		return ""
	}
	return s.telemetryService.TelemetryID
}

func (s *Server) HttpService() httpservice.HTTPService {
	return s.HTTPService
}

func (s *Server) SetLog(l *mlog.Logger) {
	s.Log = l
}
