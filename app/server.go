// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"hash/maphash"
	"html/template"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/pprof"
	"net/url"
	"os"
	"os/exec"
	"path"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"gopkg.in/yaml.v2"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/rs/cors"
	"golang.org/x/crypto/acme/autocert"

	"github.com/mattermost/mattermost-server/v6/app/email"
	"github.com/mattermost/mattermost-server/v6/app/featureflag"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/app/teams"
	"github.com/mattermost/mattermost-server/v6/app/users"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/jobs/active_users"
	"github.com/mattermost/mattermost-server/v6/jobs/expirynotify"
	"github.com/mattermost/mattermost-server/v6/jobs/export_delete"
	"github.com/mattermost/mattermost-server/v6/jobs/export_process"
	"github.com/mattermost/mattermost-server/v6/jobs/extract_content"
	"github.com/mattermost/mattermost-server/v6/jobs/import_delete"
	"github.com/mattermost/mattermost-server/v6/jobs/import_process"
	"github.com/mattermost/mattermost-server/v6/jobs/migrations"
	"github.com/mattermost/mattermost-server/v6/jobs/product_notices"
	"github.com/mattermost/mattermost-server/v6/jobs/resend_invitation_email"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/scheduler"
	"github.com/mattermost/mattermost-server/v6/services/awsmeter"
	"github.com/mattermost/mattermost-server/v6/services/cache"
	"github.com/mattermost/mattermost-server/v6/services/httpservice"
	"github.com/mattermost/mattermost-server/v6/services/remotecluster"
	"github.com/mattermost/mattermost-server/v6/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/services/searchengine/bleveengine"
	"github.com/mattermost/mattermost-server/v6/services/searchengine/bleveengine/indexer"
	"github.com/mattermost/mattermost-server/v6/services/sharedchannel"
	"github.com/mattermost/mattermost-server/v6/services/telemetry"
	"github.com/mattermost/mattermost-server/v6/services/timezones"
	"github.com/mattermost/mattermost-server/v6/services/tracing"
	"github.com/mattermost/mattermost-server/v6/services/upgrader"
	"github.com/mattermost/mattermost-server/v6/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mail"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/shared/templates"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v6/store/retrylayer"
	"github.com/mattermost/mattermost-server/v6/store/searchlayer"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
	"github.com/mattermost/mattermost-server/v6/store/timerlayer"
	"github.com/mattermost/mattermost-server/v6/utils"
)

// declaring this as var to allow overriding in tests
var SentryDSN = "placeholder_sentry_dsn"

type ServiceKey string

const (
	ChannelKey   ServiceKey = "channel"
	ConfigKey    ServiceKey = "config"
	LicenseKey   ServiceKey = "license"
	FilestoreKey ServiceKey = "filestore"
	ClusterKey   ServiceKey = "cluster"
	PostKey      ServiceKey = "post"
	TeamKey      ServiceKey = "team"
)

type Server struct {
	sqlStore        *sqlstore.SqlStore
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

	metricsServer *http.Server
	metricsRouter *mux.Router
	metricsLock   sync.Mutex

	didFinishListen chan struct{}

	goroutineCount      int32
	goroutineExitSignal chan struct{}

	EmailService email.ServiceInterface

	hubs     []*Hub
	hashSeed maphash.Seed

	httpService            httpservice.HTTPService
	PushNotificationsHub   PushNotificationsHub
	pushNotificationClient *http.Client // TODO: move this to it's own package

	runEssentialJobs bool
	Jobs             *jobs.JobServer

	clusterLeaderListeners sync.Map
	clusterWrapper         *clusterWrapper

	licenseValue       atomic.Value
	clientLicenseValue atomic.Value
	licenseListeners   map[string]func(*model.License, *model.License)
	licenseWrapper     *licenseWrapper

	timezones *timezones.Timezones

	newStore func() (store.Store, error)

	htmlTemplateWatcher     *templates.Container
	seenPendingPostIdsCache cache.Cache
	statusCache             cache.Cache
	openGraphDataCache      cache.Cache
	configListenerId        string
	licenseListenerId       string
	clusterLeaderListenerId string
	searchConfigListenerId  string
	searchLicenseListenerId string
	loggerLicenseListenerId string
	configStore             *configWrapper
	filestore               filestore.FileBackend

	telemetryService *telemetry.TelemetryService
	userService      *users.UserService
	teamService      *teams.TeamService

	serviceMux           sync.RWMutex
	remoteClusterService remotecluster.RemoteClusterServiceIFace
	sharedChannelService SharedChannelServiceIFace

	phase2PermissionsMigrationComplete bool

	Audit            *audit.Audit
	Log              *mlog.Logger
	NotificationsLog *mlog.Logger

	joinCluster       bool
	startMetrics      bool
	startSearchEngine bool
	skipPostInit      bool

	SearchEngine *searchengine.Broker

	Cluster        einterfaces.ClusterInterface
	Cloud          einterfaces.CloudInterface
	Metrics        einterfaces.MetricsInterface
	LicenseManager einterfaces.LicenseInterface

	CacheProvider cache.Provider

	tracer *tracing.Tracer

	featureFlagSynchronizer      *featureflag.Synchronizer
	featureFlagStop              chan struct{}
	featureFlagStopped           chan struct{}
	featureFlagSynchronizerMutex sync.Mutex

	products map[string]Product
}

func NewServer(options ...Option) (*Server, error) {
	rootRouter := mux.NewRouter()
	localRouter := mux.NewRouter()

	s := &Server{
		goroutineExitSignal: make(chan struct{}, 1),
		RootRouter:          rootRouter,
		LocalRouter:         localRouter,
		WebSocketRouter: &WebSocketRouter{
			handlers: make(map[string]webSocketHandler),
		},
		licenseListeners: map[string]func(*model.License, *model.License){},
		hashSeed:         maphash.MakeSeed(),
		timezones:        timezones.New(),
		products:         make(map[string]Product),
	}

	for _, option := range options {
		if err := option(s); err != nil {
			return nil, errors.Wrap(err, "failed to apply option")
		}
	}

	// Following outlines the specific set of steps
	// performed during server bootup. They are sensitive to order
	// and has dependency requirements with the previous step.
	//
	// Step 1: Config.
	if s.configStore == nil {
		innerStore, err := config.NewFileStore("config.json", true)
		if err != nil {
			return nil, errors.Wrap(err, "failed to load config")
		}
		configStore, err := config.NewStoreFromBacking(innerStore, nil, false)
		if err != nil {
			return nil, errors.Wrap(err, "failed to load config")
		}

		s.configStore = &configWrapper{srv: s, Store: configStore}
	}

	// Step 2: Logging
	if err := s.initLogging(); err != nil {
		mlog.Error("Could not initiate logging", mlog.Err(err))
	}

	subpath, err := utils.GetSubpathFromConfig(s.Config())
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse SiteURL subpath")
	}
	s.Router = s.RootRouter.PathPrefix(subpath).Subrouter()

	// This is called after initLogging() to avoid a race condition.
	mlog.Info("Server is initializing...", mlog.String("go_version", runtime.Version()))

	s.httpService = httpservice.MakeHTTPService(s)

	// Step 3: Search Engine
	// Depends on Step 1 (config).
	searchEngine := searchengine.NewBroker(s.Config())
	bleveEngine := bleveengine.NewBleveEngine(s.Config())
	if err := bleveEngine.Start(); err != nil {
		return nil, err
	}
	searchEngine.RegisterBleveEngine(bleveEngine)
	s.SearchEngine = searchEngine

	// Step 4: Init Enterprise
	// Depends on step 3 (s.SearchEngine must be non-nil)
	s.initEnterprise()

	// Step 5: Cache provider.
	// At the moment we only have this implementation
	// in the future the cache provider will be built based on the loaded config
	s.CacheProvider = cache.NewProvider()
	if err2 := s.CacheProvider.Connect(); err2 != nil {
		return nil, errors.Wrapf(err2, "Unable to connect to cache provider")
	}

	// Step 6: Store.
	// Depends on Step 1 (config), 4 (metrics, cluster) and 5 (cacheProvider).
	if s.newStore == nil {
		s.newStore = func() (store.Store, error) {
			s.sqlStore = sqlstore.New(s.Config().SqlSettings, s.Metrics)

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

	s.Store, err = s.newStore()
	if err != nil {
		return nil, errors.Wrap(err, "cannot create store")
	}

	// Needed to run before loading license.
	s.userService, err = users.New(users.ServiceConfig{
		UserStore:    s.Store.User(),
		SessionStore: s.Store.Session(),
		OAuthStore:   s.Store.OAuth(),
		ConfigFn:     s.Config,
		Metrics:      s.Metrics,
		Cluster:      s.Cluster,
		LicenseFn:    s.License,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "unable to create users service")
	}

	// Needed before loading license
	if s.statusCache, err = s.CacheProvider.NewCache(&cache.CacheOptions{
		Size:           model.StatusCacheSize,
		Striped:        true,
		StripedBuckets: maxInt(runtime.NumCPU()-1, 1),
	}); err != nil {
		return nil, errors.Wrap(err, "Unable to create status cache")
	}

	if model.BuildEnterpriseReady == "true" {
		// Dependent on user service
		s.LoadLicense()
	}

	license := s.License()
	// Step 7: Initialize filestore
	backend, err := filestore.NewFileBackend(s.Config().FileSettings.ToFileBackendSettings(license != nil && *license.Features.Compliance))
	if err != nil {
		return nil, errors.Wrap(err, "failed to initialize filebackend")
	}
	s.filestore = backend

	channelWrapper := &channelsWrapper{
		srv: s,
	}

	s.licenseWrapper = &licenseWrapper{
		srv: s,
	}

	s.clusterWrapper = &clusterWrapper{
		srv: s,
	}

	s.teamService, err = teams.New(teams.ServiceConfig{
		TeamStore:    s.Store.Team(),
		ChannelStore: s.Store.Channel(),
		GroupStore:   s.Store.Group(),
		Users:        s.userService,
		WebHub:       s,
		ConfigFn:     s.Config,
		LicenseFn:    s.License,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "unable to create teams service")
	}

	serviceMap := map[ServiceKey]interface{}{
		ChannelKey:   channelWrapper,
		ConfigKey:    s.configStore,
		LicenseKey:   s.licenseWrapper,
		FilestoreKey: s.filestore,
		ClusterKey:   s.clusterWrapper,
		TeamKey:      s.teamService,
	}

	// Step 8: Initialize products.
	// Depends on s.httpService.
	err = s.initializeProducts(products, serviceMap)
	if err != nil {
		return nil, errors.Wrap(err, "failed to initialize products")
	}

	// It is important to initialize the hub only after the global logger is set
	// to avoid race conditions while logging from inside the hub.
	// Step 9: Hub depends on s.Channels() (step 8)
	s.HubStart()

	// -------------------------------------------------------------------------
	// Everything below this is not order sensitive and safe to be moved around.
	// If you are adding a new field that is non-channels specific, please add
	// below this. Otherwise, please add it to Channels struct in app/channels.go.
	// -------------------------------------------------------------------------

	if *s.Config().LogSettings.EnableDiagnostics && *s.Config().LogSettings.EnableSentry {
		if strings.Contains(SentryDSN, "placeholder") {
			mlog.Warn("Sentry reporting is enabled, but SENTRY_DSN is not set. Disabling reporting.")
		} else {
			if err2 := sentry.Init(sentry.ClientOptions{
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
				TracesSampler: sentry.TracesSamplerFunc(func(ctx sentry.SamplingContext) sentry.Sampled {
					return sentry.SampledFalse
				}),
			}); err2 != nil {
				mlog.Warn("Sentry could not be initiated, probably bad DSN?", mlog.Err(err2))
			}
		}
	}

	if *s.Config().ServiceSettings.EnableOpenTracing {
		tracer, err2 := tracing.New()
		if err2 != nil {
			return nil, err2
		}
		s.tracer = tracer
	}

	s.pushNotificationClient = s.httpService.MakeClient(true)

	if err2 := utils.TranslationsPreInit(); err2 != nil {
		return nil, errors.Wrapf(err2, "unable to load Mattermost translation files")
	}
	model.AppErrorInit(i18n.T)

	if s.seenPendingPostIdsCache, err = s.CacheProvider.NewCache(&cache.CacheOptions{
		Size: PendingPostIDsCacheSize,
	}); err != nil {
		return nil, errors.Wrap(err, "Unable to create pending post ids cache")
	}
	if s.openGraphDataCache, err = s.CacheProvider.NewCache(&cache.CacheOptions{
		Size: openGraphMetadataCacheSize,
	}); err != nil {
		return nil, errors.Wrap(err, "Unable to create opengraphdata cache")
	}

	s.createPushNotificationsHub()

	if err2 := i18n.InitTranslations(*s.Config().LocalizationSettings.DefaultServerLocale, *s.Config().LocalizationSettings.DefaultClientLocale); err2 != nil {
		return nil, errors.Wrapf(err2, "unable to load Mattermost translation files")
	}

	templatesDir, ok := templates.GetTemplateDirectory()
	if !ok {
		return nil, errors.New("Failed find server templates in \"templates\" directory or MM_SERVER_PATH")
	}
	htmlTemplateWatcher, errorsChan, err2 := templates.NewWithWatcher(templatesDir)
	if err2 != nil {
		return nil, errors.Wrap(err2, "cannot initialize server templates")
	}
	s.Go(func() {
		for err2 := range errorsChan {
			mlog.Warn("Server templates error", mlog.Err(err2))
		}
	})
	s.htmlTemplateWatcher = htmlTemplateWatcher

	s.configListenerId = s.AddConfigListener(func(_, _ *model.Config) {
		ch := s.Channels()
		ch.regenerateClientConfig()

		message := model.NewWebSocketEvent(model.WebsocketEventConfigChanged, "", "", "", nil)

		appInstance := New(ServerConnector(ch))
		message.Add("config", appInstance.ClientConfigWithComputed())
		s.Go(func() {
			s.Publish(message)
		})

		if err = s.initLogging(); err != nil {
			mlog.Error("Error re-configuring logging after config change", mlog.Err(err))
			return
		}
	})
	s.licenseListenerId = s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		s.Channels().regenerateClientConfig()

		message := model.NewWebSocketEvent(model.WebsocketEventLicenseChanged, "", "", "", nil)
		message.Add("license", s.GetSanitizedClientLicense())
		s.Go(func() {
			s.Publish(message)
		})

	})

	s.telemetryService = telemetry.New(New(ServerConnector(s.Channels())), s.Store, s.SearchEngine, s.Log)

	emailService, err := email.NewService(email.ServiceConfig{
		ConfigFn:           s.Config,
		LicenseFn:          s.License,
		GoFn:               s.Go,
		TemplatesContainer: s.TemplatesContainer(),
		UserService:        s.userService,
		Store:              s.GetStore(),
	})
	if err != nil {
		return nil, errors.Wrapf(err, "unable to initialize email service")
	}
	s.EmailService = emailService

	s.setupFeatureFlags()

	s.initJobs()

	s.clusterLeaderListenerId = s.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if job schedulers should be running:", mlog.Bool("isLeader", s.IsLeader()))
		if s.Jobs != nil {
			s.Jobs.HandleClusterLeaderChange(s.IsLeader())
		}
		s.setupFeatureFlags()
	})

	// If configured with a subpath, redirect 404s at the root back into the subpath.
	if subpath != "/" {
		s.RootRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = path.Join(subpath, r.URL.Path)
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		})
	}

	if _, err = url.ParseRequestURI(*s.Config().ServiceSettings.SiteURL); err != nil {
		mlog.Error("SiteURL must be set. Some features will operate incorrectly if the SiteURL is not set. See documentation for details: https://docs.mattermost.com/configure/configuration-settings.html#site-url")
	}

	// Start email batching because it's not like the other jobs
	s.AddConfigListener(func(_, _ *model.Config) {
		s.EmailService.InitEmailBatching()
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

	if s.startMetrics {
		s.SetupMetricsServer()
	}

	s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		if (oldLicense == nil && newLicense == nil) || !s.startMetrics {
			return
		}

		if oldLicense != nil && newLicense != nil && *oldLicense.Features.Metrics == *newLicense.Features.Metrics {
			return
		}

		s.SetupMetricsServer()
	})

	s.SearchEngine.UpdateConfig(s.Config())
	searchConfigListenerId, searchLicenseListenerId := s.StartSearchEngine()
	s.searchConfigListenerId = searchConfigListenerId
	s.searchLicenseListenerId = searchLicenseListenerId

	// if enabled - perform initial product notices fetch
	if *s.Config().AnnouncementSettings.AdminNoticesEnabled || *s.Config().AnnouncementSettings.UserNoticesEnabled {
		go func() {
			appInstance := New(ServerConnector(s.Channels()))
			if err := appInstance.UpdateProductNotices(); err != nil {
				mlog.Warn("Failed to perform initial product notices fetch", mlog.Err(err))
			}
		}()
	}

	if s.skipPostInit {
		return s, nil
	}

	s.AddConfigListener(func(old, new *model.Config) {
		appInstance := New(ServerConnector(s.Channels()))
		if *old.GuestAccountsSettings.Enable && !*new.GuestAccountsSettings.Enable {
			if appErr := appInstance.DeactivateGuests(request.EmptyContext()); appErr != nil {
				mlog.Error("Unable to deactivate guest accounts", mlog.Err(appErr))
			}
		}
	})

	// Disable active guest accounts on first run if guest accounts are disabled
	if !*s.Config().GuestAccountsSettings.Enable {
		appInstance := New(ServerConnector(s.Channels()))
		if appErr := appInstance.DeactivateGuests(request.EmptyContext()); appErr != nil {
			mlog.Error("Unable to deactivate guest accounts", mlog.Err(appErr))
		}
	}

	if s.runEssentialJobs {
		s.Go(func() {
			appInstance := New(ServerConnector(s.Channels()))
			s.runLicenseExpirationCheckJob()
			s.runInactivityCheckJob()
			runDNDStatusExpireJob(appInstance)
		})
		s.runJobs()
	}

	s.doAppMigrations()

	s.initPostMetadata()

	// Dump the image cache if the proxy settings have changed. (need switch URLs to the correct proxy)
	s.AddConfigListener(func(oldCfg, newCfg *model.Config) {
		if (oldCfg.ImageProxySettings.Enable != newCfg.ImageProxySettings.Enable) ||
			(oldCfg.ImageProxySettings.ImageProxyType != newCfg.ImageProxySettings.ImageProxyType) ||
			(oldCfg.ImageProxySettings.RemoteImageProxyURL != newCfg.ImageProxySettings.RemoteImageProxyURL) ||
			(oldCfg.ImageProxySettings.RemoteImageProxyOptions != newCfg.ImageProxySettings.RemoteImageProxyOptions) {
			s.openGraphDataCache.Purge()
		}
	})

	return s, nil
}

func (s *Server) SetupMetricsServer() {
	if !*s.Config().MetricsSettings.Enable {
		return
	}

	s.StopMetricsServer()

	if err := s.InitMetricsRouter(); err != nil {
		mlog.Error("Error initiating metrics router.", mlog.Err(err))
	}

	if s.Metrics != nil {
		s.Metrics.Register()
	}

	s.startMetricsServer()
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (s *Server) runJobs() {
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
		runJobsCleanupJob(s)
	})
	s.Go(func() {
		runTokenCleanupJob(s)
	})
	s.Go(func() {
		runCommandWebhookCleanupJob(s)
	})
	s.Go(func() {
		runConfigCleanupJob(s)
	})

	if complianceI := s.Channels().Compliance; complianceI != nil {
		complianceI.StartComplianceDailyJob()
	}

	if *s.Config().JobSettings.RunJobs && s.Jobs != nil {
		if err := s.Jobs.StartWorkers(); err != nil {
			mlog.Error("Failed to start job server workers", mlog.Err(err))
		}
	}
	if *s.Config().JobSettings.RunScheduler && s.Jobs != nil {
		if err := s.Jobs.StartSchedulers(); err != nil {
			mlog.Error("Failed to start job server schedulers", mlog.Err(err))
		}
	}

	if *s.Config().ServiceSettings.EnableAWSMetering {
		runReportToAWSMeterJob(s)
	}
}

// Global app options that should be applied to apps created by this server
func (s *Server) AppOptions() []AppOption {
	return []AppOption{
		ServerConnector(s.Channels()),
	}
}

func (s *Server) Channels() *Channels {
	ch, _ := s.products["channels"].(*Channels)
	return ch
}

// Return Database type (postgres or mysql) and current version of the schema
func (s *Server) DatabaseTypeAndSchemaVersion() (string, string) {
	schemaVersion, _ := s.Store.GetDBSchemaVersion()
	return *s.Config().SqlSettings.DriverName, strconv.Itoa(schemaVersion)
}

// initLogging initializes and configures the logger(s). This may be called more than once.
func (s *Server) initLogging() error {
	var err error
	// create the app logger if needed
	if s.Log == nil {
		s.Log, err = mlog.NewLogger()
		if err != nil {
			return err
		}
	}

	// create notification logger if needed
	if s.NotificationsLog == nil {
		l, err := mlog.NewLogger()
		if err != nil {
			return err
		}
		s.NotificationsLog = l.With(mlog.String("logSource", "notifications"))
	}

	if err := s.configureLogger("logging", s.Log, &s.Config().LogSettings, s.configStore.Store, config.GetLogFileLocation); err != nil {
		// if the config is locked then a unit test has already configured and locked the logger; not an error.
		if !errors.Is(err, mlog.ErrConfigurationLock) {
			// revert to default logger if the config is invalid
			mlog.InitGlobalLogger(nil)
			return err
		}
	}

	// Redirect default Go logger to app logger.
	s.Log.RedirectStdLog(mlog.LvlStdLog)

	// Use the app logger as the global logger (eventually remove all instances of global logging).
	mlog.InitGlobalLogger(s.Log)

	notificationLogSettings := config.GetLogSettingsFromNotificationsLogSettings(&s.Config().NotificationLogSettings)
	if err := s.configureLogger("notification logging", s.NotificationsLog, notificationLogSettings, s.configStore.Store, config.GetNotificationsLogFileLocation); err != nil {
		if !errors.Is(err, mlog.ErrConfigurationLock) {
			mlog.Error("Error configuring notification logger", mlog.Err(err))
			return err
		}
	}
	return nil
}

// configureLogger applies the specified configuration to a logger.
func (s *Server) configureLogger(name string, logger *mlog.Logger, logSettings *model.LogSettings, configStore *config.Store, getPath func(string) string) error {
	// Advanced logging is E20 only, however logging must be initialized before the license
	// file is loaded.  If no valid E20 license exists then advanced logging will be
	// shutdown once license is loaded/checked.
	var err error
	dsn := *logSettings.AdvancedLoggingConfig
	var logConfigSrc config.LogConfigSrc
	if dsn != "" {
		logConfigSrc, err = config.NewLogConfigSrc(dsn, configStore)
		if err != nil {
			return fmt.Errorf("invalid config source for %s, %w", name, err)
		}
		mlog.Info("Loaded configuration for "+name, mlog.String("source", dsn))
	}

	cfg, err := config.MloggerConfigFromLoggerConfig(logSettings, logConfigSrc, getPath)
	if err != nil {
		return fmt.Errorf("invalid config source for %s, %w", name, err)
	}

	if err := logger.ConfigureTargets(cfg, nil); err != nil {
		return fmt.Errorf("invalid config for %s, %w", name, err)
	}
	return nil
}

// removeUnlicensedLogTargets removes any unlicensed log target types.
func (s *Server) removeUnlicensedLogTargets(license *model.License) {
	if license != nil && *license.Features.AdvancedLogging {
		// advanced logging enabled via license; no need to remove any targets
		return
	}

	timeoutCtx, cancelCtx := context.WithTimeout(context.Background(), time.Second*10)
	defer cancelCtx()

	s.Log.RemoveTargets(timeoutCtx, func(ti mlog.TargetInfo) bool {
		return ti.Type != "*targets.Writer" && ti.Type != "*targets.File"
	})

	s.NotificationsLog.RemoveTargets(timeoutCtx, func(ti mlog.TargetInfo) bool {
		return ti.Type != "*targets.Writer" && ti.Type != "*targets.File"
	})
}

func (s *Server) startInterClusterServices(license *model.License) error {
	if license == nil {
		mlog.Debug("No license provided; Remote Cluster services disabled")
		return nil
	}

	// Remote Cluster service

	// License check
	if !*license.Features.RemoteClusterService {
		mlog.Debug("License does not have Remote Cluster services enabled")
		return nil
	}

	// Config check
	if !*s.Config().ExperimentalSettings.EnableRemoteClusterService {
		mlog.Debug("Remote Cluster Service disabled via config")
		return nil
	}

	var err error

	rcs, err := remotecluster.NewRemoteClusterService(s)
	if err != nil {
		return err
	}

	if err = rcs.Start(); err != nil {
		return err
	}

	s.serviceMux.Lock()
	s.remoteClusterService = rcs
	s.serviceMux.Unlock()

	// Shared Channels service

	// License check
	if !*license.Features.SharedChannels {
		mlog.Debug("License does not have shared channels enabled")
		return nil
	}

	// Config check
	if !*s.Config().ExperimentalSettings.EnableSharedChannels {
		mlog.Debug("Shared Channels Service disabled via config")
		return nil
	}

	appInstance := New(ServerConnector(s.Channels()))
	scs, err := sharedchannel.NewSharedChannelService(s, appInstance)
	if err != nil {
		return err
	}

	if err = scs.Start(); err != nil {
		return err
	}

	s.serviceMux.Lock()
	s.sharedChannelService = scs
	s.serviceMux.Unlock()

	return nil
}

func (s *Server) enableLoggingMetrics() {
	if s.Metrics == nil {
		return
	}

	s.Log.SetMetricsCollector(s.Metrics.GetLoggerMetricsCollector(), mlog.DefaultMetricsUpdateFreqMillis)

	// logging config needs to be reloaded when metrics collector is added or changed.
	if err := s.initLogging(); err != nil {
		mlog.Error("Error re-configuring logging for metrics")
		return
	}

	mlog.Debug("Logging metrics enabled")
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

	s.serviceMux.RLock()
	if s.sharedChannelService != nil {
		if err = s.sharedChannelService.Shutdown(); err != nil {
			mlog.Error("Error shutting down shared channel services", mlog.Err(err))
		}
	}
	if s.remoteClusterService != nil {
		if err = s.remoteClusterService.Shutdown(); err != nil {
			mlog.Error("Error shutting down intercluster services", mlog.Err(err))
		}
	}
	s.serviceMux.RUnlock()

	s.StopHTTPServer()
	s.stopLocalModeServer()
	// Push notification hub needs to be shutdown after HTTP server
	// to prevent stray requests from generating a push notification after it's shut down.
	s.StopPushNotificationsHubWorkers()
	s.htmlTemplateWatcher.Close()

	s.WaitForGoroutines()

	s.RemoveConfigListener(s.configListenerId)
	s.stopSearchEngine()

	s.Audit.Shutdown()

	s.stopFeatureFlagUpdateJob()

	s.configStore.Close()

	if s.Cluster != nil {
		s.Cluster.StopInterNodeCommunication()
	}

	s.StopMetricsServer()

	// This must be done after the cluster is stopped.
	if s.Jobs != nil {
		// For simplicity we don't check if workers and schedulers are active
		// before stopping them as both calls essentially become no-ops
		// if nothing is running.
		if err = s.Jobs.StopWorkers(); err != nil && !errors.Is(err, jobs.ErrWorkersNotRunning) {
			mlog.Warn("Failed to stop job server workers", mlog.Err(err))
		}
		if err = s.Jobs.StopSchedulers(); err != nil && !errors.Is(err, jobs.ErrSchedulersNotRunning) {
			mlog.Warn("Failed to stop job server schedulers", mlog.Err(err))
		}
	}

	if s.Store != nil {
		s.Store.Close()
	}

	if s.CacheProvider != nil {
		if err = s.CacheProvider.Close(); err != nil {
			mlog.Warn("Unable to cleanly shutdown cache", mlog.Err(err))
		}
	}

	mlog.Info("Server stopped")

	// Stop products.
	// This needs to happen last because products are dependent
	// on parent services.
	for name, product := range s.products {
		if err2 := product.Stop(); err2 != nil {
			mlog.Warn("Unable to cleanly stop product", mlog.String("name", name), mlog.Err(err2))
		}
	}

	// shutdown main and notification loggers which will flush any remaining log records.
	timeoutCtx, timeoutCancel := context.WithTimeout(context.Background(), time.Second*15)
	defer timeoutCancel()
	if err = s.NotificationsLog.ShutdownWithTimeout(timeoutCtx); err != nil {
		fmt.Fprintf(os.Stderr, "Error shutting down notification logger: %v", err)
	}
	if err = s.Log.ShutdownWithTimeout(timeoutCtx); err != nil {
		fmt.Fprintf(os.Stderr, "Error shutting down main logger: %v", err)
	}
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
	val, err := s.Store.System().GetByName(model.SystemUpgradedFromTeId)
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
	upgradedFromTE := &model.System{Name: model.SystemUpgradedFromTeId, Value: "true"}
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
	// Start products.
	// This needs to happen before because products are dependent on the HTTP server.
	for name, product := range s.products {
		if err := product.Start(); err != nil {
			return errors.Wrapf(err, "Unable to start %s", name)
		}
	}

	if s.joinCluster && s.Cluster != nil {
		s.registerClusterHandlers()
		s.Cluster.StartInterNodeCommunication()
	}

	if err := s.ensureInstallationDate(); err != nil {
		return errors.Wrapf(err, "unable to ensure installation date")
	}

	if err := s.ensureFirstServerRunTimestamp(); err != nil {
		return errors.Wrapf(err, "unable to ensure first run timestamp")
	}

	if err := s.Store.Status().ResetAll(); err != nil {
		mlog.Error("Error to reset the server status.", mlog.Err(err))
	}
	if err := mail.TestConnection(s.MailServiceConfig()); err != nil {
		mlog.Error("Mail server connection test is failed", mlog.Err(err))
	}

	err := s.FileBackend().TestConnection()
	if err != nil {
		if _, ok := err.(*filestore.S3FileBackendNoBucketError); ok {
			err = s.FileBackend().(*filestore.S3FileBackend).MakeBucket()
		}
		if err != nil {
			mlog.Error("Problem with file storage settings", mlog.Err(err))
		}
	}

	s.checkPushNotificationServerURL()

	s.ReloadConfig()

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
			corsWrapper.Log = s.Log.With(mlog.String("source", "cors")).StdLogger(mlog.LvlDebug)
		}

		handler = corsWrapper.Handler(handler)
	}

	if *s.Config().RateLimitSettings.Enable {
		mlog.Info("RateLimiter is enabled")

		rateLimiter, err2 := NewRateLimiter(&s.Config().RateLimitSettings, s.Config().ServiceSettings.TrustedProxyIPHeader)
		if err2 != nil {
			return err2
		}

		s.RateLimiter = rateLimiter
		handler = rateLimiter.RateLimitHandler(handler)
	}
	s.Busy = NewBusy(s.Cluster)

	// Creating a logger for logging errors from http.Server at error level
	errStdLog := s.Log.With(mlog.String("source", "httpserver")).StdLogger(mlog.LvlError)

	s.Server = &http.Server{
		Handler:      handler,
		ReadTimeout:  time.Duration(*s.Config().ServiceSettings.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(*s.Config().ServiceSettings.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(*s.Config().ServiceSettings.IdleTimeout) * time.Second,
		ErrorLog:     errStdLog,
	}

	addr := *s.Config().ServiceSettings.ListenAddress
	if addr == "" {
		if *s.Config().ServiceSettings.ConnectionSecurity == model.ConnSecurityTLS {
			addr = ":https"
		} else {
			addr = ":http"
		}
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return errors.Wrapf(err, i18n.T("api.server.start_server.starting.critical"), err)
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
			return fmt.Errorf(i18n.T("api.server.start_server.forward80to443.enabled_but_listening_on_wrong_port"), port)
		} else {
			httpListenAddress := net.JoinHostPort(host, "http")

			if *s.Config().ServiceSettings.UseLetsEncrypt {
				server := &http.Server{
					Addr:     httpListenAddress,
					Handler:  m.HTTPHandler(nil),
					ErrorLog: s.Log.With(mlog.String("source", "le_forwarder_server")).StdLogger(mlog.LvlError),
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
						ErrorLog: s.Log.With(mlog.String("source", "forwarder_server")).StdLogger(mlog.LvlError),
					}
					server.Serve(redirectListener)
				}()
			}
		}
	} else if *s.Config().ServiceSettings.UseLetsEncrypt {
		return errors.New(i18n.T("api.server.start_server.forward80to443.disabled_while_using_lets_encrypt"))
	}

	s.didFinishListen = make(chan struct{})
	go func() {
		var err error
		if *s.Config().ServiceSettings.ConnectionSecurity == model.ConnSecurityTLS {

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

	if err := s.startInterClusterServices(s.License()); err != nil {
		mlog.Error("Error starting inter-cluster services", mlog.Err(err))
	}

	return nil
}

func (s *Server) startLocalModeServer() error {
	s.localModeServer = &http.Server{
		Handler: s.LocalRouter,
	}

	socket := *s.configStore.Get().ServiceSettings.LocalModeSocketLocation
	if err := os.RemoveAll(socket); err != nil {
		return errors.Wrapf(err, i18n.T("api.server.start_server.starting.critical"), err)
	}

	unixListener, err := net.Listen("unix", socket)
	if err != nil {
		return errors.Wrapf(err, i18n.T("api.server.start_server.starting.critical"), err)
	}
	if err = os.Chmod(socket, 0600); err != nil {
		return errors.Wrapf(err, i18n.T("api.server.start_server.starting.critical"), err)
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

func (s *Server) checkPushNotificationServerURL() {
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

func runJobsCleanupJob(s *Server) {
	doJobsCleanup(s)
	model.CreateRecurringTask("Job Cleanup", func() {
		doJobsCleanup(s)
	}, time.Hour*24)
}

func runConfigCleanupJob(s *Server) {
	doConfigCleanup(s)
	model.CreateRecurringTask("Configuration Cleanup", func() {
		doConfigCleanup(s)
	}, time.Hour*24)
}

func (s *Server) runInactivityCheckJob() {
	model.CreateRecurringTask("Server inactivity Check", func() {
		s.doInactivityCheck()
	}, time.Hour*24)
}

func (s *Server) runLicenseExpirationCheckJob() {
	s.doLicenseExpirationCheck()
	model.CreateRecurringTask("License Expiration Check", func() {
		s.doLicenseExpirationCheck()
	}, time.Hour*24)
}

func runReportToAWSMeterJob(s *Server) {
	model.CreateRecurringTask("Collect and send usage report to AWS Metering Service", func() {
		doReportUsageToAWSMeteringService(s)
	}, time.Hour*model.AwsMeteringReportInterval)
}

func doReportUsageToAWSMeteringService(s *Server) {
	awsMeter := awsmeter.New(s.Store, s.Config())
	if awsMeter == nil {
		mlog.Error("Cannot obtain instance of AWS Metering Service.")
		return
	}

	dimensions := []string{model.AwsMeteringDimensionUsageHrs}
	reports := awsMeter.GetUserCategoryUsage(dimensions, time.Now().UTC(), time.Now().Add(-model.AwsMeteringReportInterval*time.Hour).UTC())
	awsMeter.ReportUserCategoryUsage(reports)
}

func doSecurity(s *Server) {
	s.DoSecurityUpdateCheck()
}

func doTokenCleanup(s *Server) {
	expiry := model.GetMillis() - model.MaxTokenExipryTime

	mlog.Debug("Cleaning up token store.")

	s.Store.Token().Cleanup(expiry)
}

func doCommandWebhookCleanup(s *Server) {
	s.Store.CommandWebhook().Cleanup()
}

const (
	sessionsCleanupBatchSize = 1000
	jobsCleanupBatchSize     = 1000
)

func doSessionCleanup(s *Server) {
	mlog.Debug("Cleaning up session store.")
	err := s.Store.Session().Cleanup(model.GetMillis(), sessionsCleanupBatchSize)
	if err != nil {
		mlog.Warn("Error while cleaning up sessions", mlog.Err(err))
	}
}

func doJobsCleanup(s *Server) {
	if *s.Config().JobSettings.CleanupJobsThresholdDays < 0 {
		return
	}
	mlog.Debug("Cleaning up jobs store.")

	dur := time.Duration(*s.Config().JobSettings.CleanupJobsThresholdDays) * time.Hour * 24
	expiry := model.GetMillisForTime(time.Now().Add(-dur))
	err := s.Store.Job().Cleanup(expiry, jobsCleanupBatchSize)
	if err != nil {
		mlog.Warn("Error while cleaning up jobs", mlog.Err(err))
	}
}

func doConfigCleanup(s *Server) {
	if *s.Config().JobSettings.CleanupConfigThresholdDays < 0 || !config.IsDatabaseDSN(s.ConfigStore().Store.String()) {
		return
	}
	mlog.Info("Cleaning up configuration store.")

	if err := s.ConfigStore().Store.CleanUp(); err != nil {
		mlog.Warn("Error while cleaning up configurations", mlog.Err(err))
	}
}

func (s *Server) StopMetricsServer() {
	s.metricsLock.Lock()
	defer s.metricsLock.Unlock()

	if s.metricsServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), TimeToWaitForConnectionsToCloseOnServerShutdown)
		defer cancel()

		s.metricsServer.Shutdown(ctx)
		s.Log.Info("Metrics and profiling server is stopping")
	}
}

func (s *Server) HandleMetrics(route string, h http.Handler) {
	if s.metricsRouter != nil {
		s.metricsRouter.Handle(route, h)
	}
}

func (s *Server) InitMetricsRouter() error {
	s.metricsRouter = mux.NewRouter()
	runtime.SetBlockProfileRate(*s.Config().MetricsSettings.BlockProfileRate)

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
		metricsPageTmpl.Execute(w, s.Metrics != nil)
	}

	s.metricsRouter.HandleFunc("/", rootHandler)
	s.metricsRouter.StrictSlash(true)

	s.metricsRouter.Handle("/debug", http.RedirectHandler("/", http.StatusMovedPermanently))
	s.metricsRouter.HandleFunc("/debug/pprof/", pprof.Index)
	s.metricsRouter.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	s.metricsRouter.HandleFunc("/debug/pprof/profile", pprof.Profile)
	s.metricsRouter.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	s.metricsRouter.HandleFunc("/debug/pprof/trace", pprof.Trace)

	// Manually add support for paths linked to by index page at /debug/pprof/
	s.metricsRouter.Handle("/debug/pprof/goroutine", pprof.Handler("goroutine"))
	s.metricsRouter.Handle("/debug/pprof/heap", pprof.Handler("heap"))
	s.metricsRouter.Handle("/debug/pprof/threadcreate", pprof.Handler("threadcreate"))
	s.metricsRouter.Handle("/debug/pprof/block", pprof.Handler("block"))

	return nil
}

func (s *Server) startMetricsServer() {
	var notify chan struct{}
	s.metricsLock.Lock()
	defer func() {
		if notify != nil {
			<-notify
		}
		s.metricsLock.Unlock()
	}()

	l, err := net.Listen("tcp", *s.Config().MetricsSettings.ListenAddress)
	if err != nil {
		mlog.Error(err.Error())
		return
	}

	notify = make(chan struct{})
	s.metricsServer = &http.Server{
		Handler:      handlers.RecoveryHandler(handlers.PrintRecoveryStack(true))(s.metricsRouter),
		ReadTimeout:  time.Duration(*s.Config().ServiceSettings.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(*s.Config().ServiceSettings.WriteTimeout) * time.Second,
	}

	go func() {
		close(notify)
		if err := s.metricsServer.Serve(l); err != nil && err != http.ErrServerClosed {
			mlog.Critical(err.Error())
		}
	}()

	s.Log.Info("Metrics and profiling server is started", mlog.String("address", l.Addr().String()))
}

func (s *Server) sendLicenseUpForRenewalEmail(users map[string]*model.User, license *model.License) *model.AppError {
	key := model.LicenseUpForRenewalEmailSent + license.Id
	if _, err := s.Store.System().GetByName(key); err == nil {
		// return early because the key already exists and that means we already executed the code below to send email successfully
		return nil
	}

	daysToExpiration := license.DaysToExpiration()

	renewalLink, _, appErr := s.GenerateLicenseRenewalLink()
	if appErr != nil {
		return model.NewAppError("s.sendLicenseUpForRenewalEmail", "api.server.license_up_for_renewal.error_generating_link", nil, appErr.Error(), http.StatusInternalServerError)
	}

	// we want to at least have one email sent out to an admin
	countNotOks := 0

	for _, user := range users {
		name := user.FirstName
		if name == "" {
			name = user.Username
		}
		if err := s.EmailService.SendLicenseUpForRenewalEmail(user.Email, name, user.Locale, *s.Config().ServiceSettings.SiteURL, renewalLink, daysToExpiration); err != nil {
			mlog.Error("Error sending license up for renewal email to", mlog.String("user_email", user.Email), mlog.Err(err))
			countNotOks++
		}
	}

	// if not even one admin got an email, we consider that this operation errored
	if countNotOks == len(users) {
		return model.NewAppError("s.sendLicenseUpForRenewalEmail", "api.server.license_up_for_renewal.error_sending_email", nil, "", http.StatusInternalServerError)
	}

	system := model.System{
		Name:  key,
		Value: "true",
	}

	if err := s.Store.System().Save(&system); err != nil {
		mlog.Debug("Failed to mark license up for renewal email sending as completed.", mlog.Err(err))
	}

	return nil
}

func (s *Server) doLicenseExpirationCheck() {
	s.LoadLicense()

	// This takes care of a rare edge case reported here https://mattermost.atlassian.net/browse/MM-40962
	// To reproduce that case locally, attach a license to a server that was started with enterprise enabled
	// Then restart using BUILD_ENTERPRISE=false make restart-server to enter Team Edition
	if model.BuildEnterpriseReady != "true" {
		mlog.Debug("Skipping license expiration check because no license is expected on Team Edition")
		return
	}

	license := s.License()

	if license == nil {
		mlog.Debug("License cannot be found.")
		return
	}

	if *license.Features.Cloud {
		mlog.Debug("Skipping license expiration check for Cloud")
		return
	}

	users, err := s.Store.User().GetSystemAdminProfiles()
	if err != nil {
		mlog.Error("Failed to get system admins for license expired message from Mattermost.")
		return
	}

	if license.IsWithinExpirationPeriod() {
		appErr := s.sendLicenseUpForRenewalEmail(users, license)
		if appErr != nil {
			mlog.Debug(appErr.Error())
		}
		return
	}

	if !license.IsPastGracePeriod() {
		mlog.Debug("License is not past the grace period.")
		return
	}

	renewalLink, _, appErr := s.GenerateLicenseRenewalLink()
	if appErr != nil {
		mlog.Error("Error while sending the license expired email.", mlog.Err(appErr))
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
			if err := s.SendRemoveExpiredLicenseEmail(user.Email, renewalLink, user.Locale, *s.Config().ServiceSettings.SiteURL); err != nil {
				mlog.Error("Error while sending the license expired email.", mlog.String("user_email", user.Email), mlog.Err(err))
			}
		})
	}

	//remove the license
	s.RemoveLicense()
}

// SendRemoveExpiredLicenseEmail formats an email and uses the email service to send the email to user with link pointing to CWS
// to renew the user license
func (s *Server) SendRemoveExpiredLicenseEmail(email string, renewalLink, locale, siteURL string) *model.AppError {

	if err := s.EmailService.SendRemoveExpiredLicenseEmail(renewalLink, email, locale, siteURL); err != nil {
		return model.NewAppError("SendRemoveExpiredLicenseEmail", "api.license.remove_expired_license.failed.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
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
		} else if s.SearchEngine.ElasticsearchEngine != nil && *oldConfig.ElasticsearchSettings.Password != *newConfig.ElasticsearchSettings.Password || *oldConfig.ElasticsearchSettings.Username != *newConfig.ElasticsearchSettings.Username || *oldConfig.ElasticsearchSettings.ConnectionURL != *newConfig.ElasticsearchSettings.ConnectionURL || *oldConfig.ElasticsearchSettings.Sniff != *newConfig.ElasticsearchSettings.Sniff {
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

func (s *Server) FileBackend() filestore.FileBackend {
	return s.filestore
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

func (ch *Channels) ClientConfigHash() string {
	return ch.clientConfigHash.Load().(string)
}

func (s *Server) initJobs() {
	s.Jobs = jobs.NewJobServer(s, s.Store, s.Metrics)

	if jobsDataRetentionJobInterface != nil {
		builder := jobsDataRetentionJobInterface(s)
		s.Jobs.RegisterJobType(model.JobTypeDataRetention, builder.MakeWorker(), builder.MakeScheduler())
	}

	if jobsMessageExportJobInterface != nil {
		builder := jobsMessageExportJobInterface(s)
		s.Jobs.RegisterJobType(model.JobTypeMessageExport, builder.MakeWorker(), builder.MakeScheduler())
	}

	if jobsElasticsearchAggregatorInterface != nil {
		builder := jobsElasticsearchAggregatorInterface(s)
		s.Jobs.RegisterJobType(model.JobTypeElasticsearchPostAggregation, builder.MakeWorker(), builder.MakeScheduler())
	}

	if jobsElasticsearchIndexerInterface != nil {
		builder := jobsElasticsearchIndexerInterface(s)
		s.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, builder.MakeWorker(), nil)
	}

	if jobsLdapSyncInterface != nil {
		builder := jobsLdapSyncInterface(New(ServerConnector(s.Channels())))
		s.Jobs.RegisterJobType(model.JobTypeLdapSync, builder.MakeWorker(), builder.MakeScheduler())
	}

	s.Jobs.RegisterJobType(
		model.JobTypeBlevePostIndexing,
		indexer.MakeWorker(s.Jobs, s.SearchEngine.BleveEngine.(*bleveengine.BleveEngine)),
		nil,
	)

	s.Jobs.RegisterJobType(
		model.JobTypeMigrations,
		migrations.MakeWorker(s.Jobs, s.Store),
		migrations.MakeScheduler(s.Jobs, s.Store),
	)

	s.Jobs.RegisterJobType(
		model.JobTypePlugins,
		scheduler.MakeWorker(s.Jobs, New(ServerConnector(s.Channels()))),
		scheduler.MakeScheduler(s.Jobs),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeExpiryNotify,
		expirynotify.MakeWorker(s.Jobs, New(ServerConnector(s.Channels())).NotifySessionsExpired),
		expirynotify.MakeScheduler(s.Jobs),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeProductNotices,
		product_notices.MakeWorker(s.Jobs, New(ServerConnector(s.Channels()))),
		product_notices.MakeScheduler(s.Jobs),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeImportProcess,
		import_process.MakeWorker(s.Jobs, New(ServerConnector(s.Channels()))),
		nil,
	)

	s.Jobs.RegisterJobType(
		model.JobTypeImportDelete,
		import_delete.MakeWorker(s.Jobs, New(ServerConnector(s.Channels())), s.Store),
		import_delete.MakeScheduler(s.Jobs),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeExportDelete,
		export_delete.MakeWorker(s.Jobs, New(ServerConnector(s.Channels()))),
		export_delete.MakeScheduler(s.Jobs),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeExportProcess,
		export_process.MakeWorker(s.Jobs, New(ServerConnector(s.Channels()))),
		nil,
	)

	s.Jobs.RegisterJobType(
		model.JobTypeActiveUsers,
		active_users.MakeWorker(s.Jobs, s.Store, func() einterfaces.MetricsInterface { return s.Metrics }),
		active_users.MakeScheduler(s.Jobs),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeResendInvitationEmail,
		resend_invitation_email.MakeWorker(s.Jobs, New(ServerConnector(s.Channels())), s.Store, s.telemetryService),
		nil,
	)

	s.Jobs.RegisterJobType(
		model.JobTypeExtractContent,
		extract_content.MakeWorker(s.Jobs, New(ServerConnector(s.Channels())), s.Store),
		nil,
	)
}

func (s *Server) TelemetryId() string {
	if s.telemetryService == nil {
		return ""
	}
	return s.telemetryService.TelemetryID
}

func (s *Server) HTTPService() httpservice.HTTPService {
	return s.httpService
}

func (s *Server) SetLog(l *mlog.Logger) {
	s.Log = l
}

func (s *Server) GetLogger() mlog.LoggerIFace {
	return s.Log
}

// GetStore returns the server's Store. Exposing via a method
// allows interfaces to be created with subsets of server APIs.
func (s *Server) GetStore() store.Store {
	return s.Store
}

// GetRemoteClusterService returns the `RemoteClusterService` instantiated by the server.
// May be nil if the service is not enabled via license.
func (s *Server) GetRemoteClusterService() remotecluster.RemoteClusterServiceIFace {
	s.serviceMux.RLock()
	defer s.serviceMux.RUnlock()
	return s.remoteClusterService
}

// GetSharedChannelSyncService returns the `SharedChannelSyncService` instantiated by the server.
// May be nil if the service is not enabled via license.
func (s *Server) GetSharedChannelSyncService() SharedChannelServiceIFace {
	s.serviceMux.RLock()
	defer s.serviceMux.RUnlock()
	return s.sharedChannelService
}

// GetMetrics returns the server's Metrics interface. Exposing via a method
// allows interfaces to be created with subsets of server APIs.
func (s *Server) GetMetrics() einterfaces.MetricsInterface {
	return s.Metrics
}

// SetRemoteClusterService sets the `RemoteClusterService` to be used by the server.
// For testing only.
func (s *Server) SetRemoteClusterService(remoteClusterService remotecluster.RemoteClusterServiceIFace) {
	s.serviceMux.Lock()
	defer s.serviceMux.Unlock()
	s.remoteClusterService = remoteClusterService
}

// SetSharedChannelSyncService sets the `SharedChannelSyncService` to be used by the server.
// For testing only.
func (s *Server) SetSharedChannelSyncService(sharedChannelService SharedChannelServiceIFace) {
	s.serviceMux.Lock()
	defer s.serviceMux.Unlock()
	s.sharedChannelService = sharedChannelService
}

func (a *App) GenerateSupportPacket() []model.FileData {
	// If any errors we come across within this function, we will log it in a warning.txt file so that we know why certain files did not get produced if any
	var warnings []string

	// Creating an array of files that we are going to be adding to our zip file
	fileDatas := []model.FileData{}

	// A array of the functions that we can iterate through since they all have the same return value
	functions := []func() (*model.FileData, string){
		a.generateSupportPacketYaml,
		a.createPluginsFile,
		a.createSanitizedConfigFile,
		a.getMattermostLog,
		a.getNotificationsLog,
	}

	for _, fn := range functions {
		fileData, warning := fn()

		if fileData != nil {
			fileDatas = append(fileDatas, *fileData)
		} else {
			warnings = append(warnings, warning)
		}
	}

	// Adding a warning.txt file to the fileDatas if any warning
	if len(warnings) > 0 {
		finalWarning := strings.Join(warnings, "\n")
		fileDatas = append(fileDatas, model.FileData{
			Filename: "warning.txt",
			Body:     []byte(finalWarning),
		})
	}

	return fileDatas
}

func (a *App) getNotificationsLog() (*model.FileData, string) {
	var warning string

	// Getting notifications.log
	if *a.Config().NotificationLogSettings.EnableFile {
		// notifications.log
		notificationsLog := config.GetNotificationsLogFileLocation(*a.Config().LogSettings.FileLocation)

		notificationsLogFileData, notificationsLogFileDataErr := ioutil.ReadFile(notificationsLog)

		if notificationsLogFileDataErr == nil {
			fileData := model.FileData{
				Filename: "notifications.log",
				Body:     notificationsLogFileData,
			}
			return &fileData, ""
		}

		warning = fmt.Sprintf("ioutil.ReadFile(notificationsLog) Error: %s", notificationsLogFileDataErr.Error())

	} else {
		warning = "Unable to retrieve notifications.log because LogSettings: EnableFile is false in config.json"
	}

	return nil, warning
}

func (a *App) getMattermostLog() (*model.FileData, string) {
	var warning string

	// Getting mattermost.log
	if *a.Config().LogSettings.EnableFile {
		// mattermost.log
		mattermostLog := config.GetLogFileLocation(*a.Config().LogSettings.FileLocation)

		mattermostLogFileData, mattermostLogFileDataErr := ioutil.ReadFile(mattermostLog)

		if mattermostLogFileDataErr == nil {
			fileData := model.FileData{
				Filename: "mattermost.log",
				Body:     mattermostLogFileData,
			}
			return &fileData, ""
		}
		warning = fmt.Sprintf("ioutil.ReadFile(mattermostLog) Error: %s", mattermostLogFileDataErr.Error())

	} else {
		warning = "Unable to retrieve mattermost.log because LogSettings: EnableFile is false in config.json"
	}

	return nil, warning
}

func (a *App) createSanitizedConfigFile() (*model.FileData, string) {
	// Getting sanitized config, prettifying it, and then adding it to our file data array
	sanitizedConfigPrettyJSON, err := json.MarshalIndent(a.GetSanitizedConfig(), "", "    ")
	if err == nil {
		fileData := model.FileData{
			Filename: "sanitized_config.json",
			Body:     sanitizedConfigPrettyJSON,
		}
		return &fileData, ""
	}

	warning := fmt.Sprintf("json.MarshalIndent(c.App.GetSanitizedConfig()) Error: %s", err.Error())
	return nil, warning
}

func (a *App) createPluginsFile() (*model.FileData, string) {
	var warning string

	// Getting the plugins installed on the server, prettify it, and then add them to the file data array
	pluginsResponse, appErr := a.GetPlugins()
	if appErr == nil {
		pluginsPrettyJSON, err := json.MarshalIndent(pluginsResponse, "", "    ")
		if err == nil {
			fileData := model.FileData{
				Filename: "plugins.json",
				Body:     pluginsPrettyJSON,
			}

			return &fileData, ""
		}

		warning = fmt.Sprintf("json.MarshalIndent(pluginsResponse) Error: %s", err.Error())
	} else {
		warning = fmt.Sprintf("c.App.GetPlugins() Error: %s", appErr.Error())
	}

	return nil, warning
}

func (a *App) generateSupportPacketYaml() (*model.FileData, string) {
	// Here we are getting information regarding Elastic Search
	var elasticServerVersion string
	var elasticServerPlugins []string
	if a.Srv().SearchEngine.ElasticsearchEngine != nil {
		elasticServerVersion = a.Srv().SearchEngine.ElasticsearchEngine.GetFullVersion()
		elasticServerPlugins = a.Srv().SearchEngine.ElasticsearchEngine.GetPlugins()
	}

	// Here we are getting information regarding LDAP
	ldapInterface := a.ch.Ldap
	var vendorName, vendorVersion string
	if ldapInterface != nil {
		vendorName, vendorVersion = ldapInterface.GetVendorNameAndVendorVersion()
	}

	// Here we are getting information regarding the database (mysql/postgres + current schema version)
	databaseType, databaseVersion := a.Srv().DatabaseTypeAndSchemaVersion()

	// Creating the struct for support packet yaml file
	supportPacket := model.SupportPacket{
		ServerOS:             runtime.GOOS,
		ServerArchitecture:   runtime.GOARCH,
		ServerVersion:        model.CurrentVersion,
		BuildHash:            model.BuildHash,
		DatabaseType:         databaseType,
		DatabaseVersion:      databaseVersion,
		LdapVendorName:       vendorName,
		LdapVendorVersion:    vendorVersion,
		ElasticServerVersion: elasticServerVersion,
		ElasticServerPlugins: elasticServerPlugins,
	}

	// Marshal to a Yaml File
	supportPacketYaml, err := yaml.Marshal(&supportPacket)
	if err == nil {
		fileData := model.FileData{
			Filename: "support_packet.yaml",
			Body:     supportPacketYaml,
		}
		return &fileData, ""
	}

	warning := fmt.Sprintf("yaml.Marshal(&supportPacket) Error: %s", err.Error())
	return nil, warning
}

func (s *Server) GetProfileImage(user *model.User) ([]byte, bool, *model.AppError) {
	if *s.Config().FileSettings.DriverName == "" {
		img, appErr := s.GetDefaultProfileImage(user)
		if appErr != nil {
			return nil, false, appErr
		}
		return img, false, nil
	}

	path := "users/" + user.Id + "/profile.png"

	data, err := s.ReadFile(path)
	if err != nil {
		img, appErr := s.GetDefaultProfileImage(user)
		if appErr != nil {
			return nil, false, appErr
		}

		if user.LastPictureUpdate == 0 {
			if _, err := s.writeFile(bytes.NewReader(img), path); err != nil {
				return nil, false, err
			}
		}
		return img, true, nil
	}

	return data, false, nil
}

func (s *Server) GetDefaultProfileImage(user *model.User) ([]byte, *model.AppError) {
	img, err := s.userService.GetDefaultProfileImage(user)
	if err != nil {
		switch {
		case errors.Is(err, users.DefaultFontError):
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.default_font.app_error", nil, err.Error(), http.StatusInternalServerError)
		case errors.Is(err, users.UserInitialsError):
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.initial.app_error", nil, err.Error(), http.StatusInternalServerError)
		default:
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.encode.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return img, nil
}

func (s *Server) ReadFile(path string) ([]byte, *model.AppError) {
	result, nErr := s.FileBackend().ReadFile(path)
	if nErr != nil {
		return nil, model.NewAppError("ReadFile", "api.file.read_file.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return result, nil
}

func createDNDStatusExpirationRecurringTask(a *App) {
	a.ch.dndTaskMut.Lock()
	a.ch.dndTask = model.CreateRecurringTaskFromNextIntervalTime("Unset DND Statuses", a.UpdateDNDStatusOfUsers, 5*time.Minute)
	a.ch.dndTaskMut.Unlock()
}

func cancelDNDStatusExpirationRecurringTask(a *App) {
	a.ch.dndTaskMut.Lock()
	if a.ch.dndTask != nil {
		a.ch.dndTask.Cancel()
		a.ch.dndTask = nil
	}
	a.ch.dndTaskMut.Unlock()
}

func runDNDStatusExpireJob(a *App) {
	if a.IsLeader() {
		createDNDStatusExpirationRecurringTask(a)
	}
	a.ch.srv.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if unset DNS status task should be running", mlog.Bool("isLeader", a.IsLeader()))
		if a.IsLeader() {
			createDNDStatusExpirationRecurringTask(a)
		} else {
			cancelDNDStatusExpirationRecurringTask(a)
		}
	})
}

func (a *App) GetAppliedSchemaMigrations() ([]model.AppliedMigration, *model.AppError) {
	table, err := a.Srv().Store.GetAppliedMigrations()
	if err != nil {
		return nil, model.NewAppError("GetDBSchemaTable", "api.file.read_file.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return table, nil
}
