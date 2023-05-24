// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/rs/cors"
	"golang.org/x/crypto/acme/autocert"

	"github.com/mattermost/mattermost-server/v6/app/email"
	"github.com/mattermost/mattermost-server/v6/app/platform"
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
	"github.com/mattermost/mattermost-server/v6/jobs/last_accessible_file"
	"github.com/mattermost/mattermost-server/v6/jobs/last_accessible_post"
	"github.com/mattermost/mattermost-server/v6/jobs/migrations"
	"github.com/mattermost/mattermost-server/v6/jobs/notify_admin"
	"github.com/mattermost/mattermost-server/v6/jobs/product_notices"
	"github.com/mattermost/mattermost-server/v6/jobs/resend_invitation_email"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/scheduler"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/services/awsmeter"
	"github.com/mattermost/mattermost-server/v6/services/cache"
	"github.com/mattermost/mattermost-server/v6/services/httpservice"
	"github.com/mattermost/mattermost-server/v6/services/remotecluster"
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
	"github.com/mattermost/mattermost-server/v6/utils"
)

// declaring this as var to allow overriding in tests
var SentryDSN = "placeholder_sentry_dsn"

type Server struct {
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

	localModeServer *http.Server

	didFinishListen chan struct{}

	EmailService email.ServiceInterface

	httpService            httpservice.HTTPService
	PushNotificationsHub   PushNotificationsHub
	pushNotificationClient *http.Client // TODO: move this to it's own package

	runEssentialJobs bool
	Jobs             *jobs.JobServer

	licenseWrapper *licenseWrapper

	timezones *timezones.Timezones

	htmlTemplateWatcher     *templates.Container
	seenPendingPostIdsCache cache.Cache
	openGraphDataCache      cache.Cache
	clusterLeaderListenerId string
	loggerLicenseListenerId string

	platform         *platform.PlatformService
	platformOptions  []platform.Option
	telemetryService *telemetry.TelemetryService
	userService      *users.UserService
	teamService      *teams.TeamService

	serviceMux           sync.RWMutex
	remoteClusterService remotecluster.RemoteClusterServiceIFace
	sharedChannelService SharedChannelServiceIFace // TODO: platform: move to platform package

	phase2PermissionsMigrationComplete bool

	Audit *audit.Audit

	joinCluster bool
	// startSearchEngine bool
	skipPostInit bool

	Cloud einterfaces.CloudInterface

	tracer *tracing.Tracer

	products map[string]product.Product

	hooksManager *product.HooksManager
}

func (s *Server) Store() store.Store {
	if s.platform != nil {
		return s.platform.Store
	}

	return nil
}

func (s *Server) SetStore(st store.Store) {
	if s.platform != nil {
		s.platform.Store = st
	}
}

func NewServer(options ...Option) (*Server, error) {
	rootRouter := mux.NewRouter()
	localRouter := mux.NewRouter()

	s := &Server{
		RootRouter:  rootRouter,
		LocalRouter: localRouter,
		timezones:   timezones.New(),
		products:    make(map[string]product.Product),
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
	// Step 1: Platform.
	if s.platform == nil {
		ps, sErr := platform.New(platform.ServiceConfig{}, s.platformOptions...)
		if sErr != nil {
			return nil, errors.Wrap(sErr, "failed to initialize platform")
		}
		s.platform = ps
	}

	subpath, err := utils.GetSubpathFromConfig(s.platform.Config())
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse SiteURL subpath")
	}
	s.Router = s.RootRouter.PathPrefix(subpath).Subrouter()

	s.httpService = httpservice.MakeHTTPService(s.platform)

	// Step 2: Init Enterprise
	// Depends on step 1 (s.Platform must be non-nil)
	s.initEnterprise()

	// Needed to run before loading license.
	s.userService, err = users.New(users.ServiceConfig{
		UserStore:    s.Store().User(),
		SessionStore: s.Store().Session(),
		OAuthStore:   s.Store().OAuth(),
		ConfigFn:     s.platform.Config,
		Metrics:      s.GetMetrics(),
		Cluster:      s.platform.Cluster(),
		LicenseFn:    s.License,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "unable to create users service")
	}

	if model.BuildEnterpriseReady == "true" {
		// Dependent on user service
		s.LoadLicense()
	}

	s.licenseWrapper = &licenseWrapper{
		srv: s,
	}

	s.teamService, err = teams.New(teams.ServiceConfig{
		TeamStore:    s.Store().Team(),
		ChannelStore: s.Store().Channel(),
		GroupStore:   s.Store().Group(),
		Users:        s.userService,
		WebHub:       s.platform,
		ConfigFn:     s.platform.Config,
		LicenseFn:    s.License,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "unable to create teams service")
	}

	s.hooksManager = product.NewHooksManager(s.GetMetrics())

	// ensure app implements `product.UserService`
	var _ product.UserService = (*App)(nil)

	app := New(ServerConnector(s.Channels()))
	serviceMap := map[product.ServiceKey]any{
		ServerKey:                s,
		product.ChannelKey:       &channelsWrapper{srv: s, app: app},
		product.ConfigKey:        s.platform,
		product.LicenseKey:       s.licenseWrapper,
		product.FilestoreKey:     s.platform.FileBackend(),
		product.FileInfoStoreKey: &fileInfoWrapper{srv: s},
		product.ClusterKey:       s.platform,
		product.UserKey:          app,
		product.LogKey:           s.platform.Log(),
		product.CloudKey:         &cloudWrapper{cloud: s.Cloud},
		product.KVStoreKey:       s.platform,
		product.StoreKey:         store.NewStoreServiceAdapter(s.Store()),
		product.SystemKey:        &systemServiceAdapter{server: s},
	}

	// Step 4: Initialize products.
	// Depends on s.httpService.
	err = s.initializeProducts(product.GetProducts(), serviceMap)
	if err != nil {
		return nil, errors.Wrap(err, "failed to initialize products")
	}

	// It is important to initialize the hub only after the global logger is set
	// to avoid race conditions while logging from inside the hub.
	// Step 5: Start hub in platform which the hub depends on s.Channels() (step 4)
	s.platform.Start()

	// -------------------------------------------------------------------------
	// Everything below this is not order sensitive and safe to be moved around.
	// If you are adding a new field that is non-channels specific, please add
	// below this. Otherwise, please add it to Channels struct in app/channels.go.
	// -------------------------------------------------------------------------

	if *s.platform.Config().LogSettings.EnableDiagnostics && *s.platform.Config().LogSettings.EnableSentry {
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
				EnableTracing: false,
				TracesSampler: sentry.TracesSampler(func(ctx sentry.SamplingContext) float64 {
					return 0.0
				}),
			}); err2 != nil {
				mlog.Warn("Sentry could not be initiated, probably bad DSN?", mlog.Err(err2))
			}
		}
	}

	if *s.platform.Config().ServiceSettings.EnableOpenTracing {
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

	if s.seenPendingPostIdsCache, err = s.platform.CacheProvider().NewCache(&cache.CacheOptions{
		Size: PendingPostIDsCacheSize,
	}); err != nil {
		return nil, errors.Wrap(err, "Unable to create pending post ids cache")
	}
	if s.openGraphDataCache, err = s.platform.CacheProvider().NewCache(&cache.CacheOptions{
		Size: openGraphMetadataCacheSize,
	}); err != nil {
		return nil, errors.Wrap(err, "Unable to create opengraphdata cache")
	}

	s.createPushNotificationsHub(request.EmptyContext(s.Log()))

	if err2 := i18n.InitTranslations(*s.platform.Config().LocalizationSettings.DefaultServerLocale, *s.platform.Config().LocalizationSettings.DefaultClientLocale); err2 != nil {
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

	s.telemetryService = telemetry.New(New(ServerConnector(s.Channels())), s.Store(), s.platform.SearchEngine, s.Log(), *s.Config().LogSettings.VerboseDiagnostics)
	s.platform.SetTelemetryId(s.TelemetryId()) // TODO: move this into platform once telemetry service moved to platform.

	emailService, err := email.NewService(email.ServiceConfig{
		ConfigFn:           s.platform.Config,
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

	s.platform.SetupFeatureFlags()

	s.initJobs()

	s.clusterLeaderListenerId = s.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if job schedulers should be running:", mlog.Bool("isLeader", s.IsLeader()))
		if s.Jobs != nil {
			s.Jobs.HandleClusterLeaderChange(s.IsLeader())
		}
		s.platform.SetupFeatureFlags()
	})

	// If configured with a subpath, redirect 404s at the root back into the subpath.
	if subpath != "/" {
		s.RootRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = path.Join(subpath, r.URL.Path)
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		})
	}

	if _, err = url.ParseRequestURI(*s.platform.Config().ServiceSettings.SiteURL); err != nil {
		mlog.Error("SiteURL must be set. Some features will operate incorrectly if the SiteURL is not set. See documentation for details: https://docs.mattermost.com/configure/configuration-settings.html#site-url")
	}

	// Start email batching because it's not like the other jobs
	s.platform.AddConfigListener(func(_, _ *model.Config) {
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
	mlog.Info("Loaded config", mlog.String("source", s.platform.DescribeConfig()))

	license := s.License()
	allowAdvancedLogging := license != nil && *license.Features.AdvancedLogging

	if s.Audit == nil {
		s.Audit = &audit.Audit{}
		s.Audit.Init(audit.DefMaxQueueSize)
		if err = s.configureAudit(s.Audit, allowAdvancedLogging); err != nil {
			mlog.Error("Error configuring audit", mlog.Err(err))
		}
	}

	s.platform.RemoveUnlicensedLogTargets(license)
	s.platform.EnableLoggingMetrics()

	s.loggerLicenseListenerId = s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		s.platform.RemoveUnlicensedLogTargets(newLicense)
		s.platform.EnableLoggingMetrics()
	})

	// if enabled - perform initial product notices fetch
	if *s.platform.Config().AnnouncementSettings.AdminNoticesEnabled || *s.platform.Config().AnnouncementSettings.UserNoticesEnabled {
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

	s.platform.AddConfigListener(func(old, new *model.Config) {
		appInstance := New(ServerConnector(s.Channels()))
		if *old.GuestAccountsSettings.Enable && !*new.GuestAccountsSettings.Enable {
			c := request.EmptyContext(s.Log())
			if appErr := appInstance.DeactivateGuests(c); appErr != nil {
				mlog.Error("Unable to deactivate guest accounts", mlog.Err(appErr))
			}
		}
	})

	// Disable active guest accounts on first run if guest accounts are disabled
	if !*s.platform.Config().GuestAccountsSettings.Enable {
		appInstance := New(ServerConnector(s.Channels()))
		c := request.EmptyContext(s.Log())
		if appErr := appInstance.DeactivateGuests(c); appErr != nil {
			mlog.Error("Unable to deactivate guest accounts", mlog.Err(appErr))
		}
	}

	if s.runEssentialJobs {
		s.Go(func() {
			appInstance := New(ServerConnector(s.Channels()))
			s.runLicenseExpirationCheckJob()
			s.runInactivityCheckJob()
			runDNDStatusExpireJob(appInstance)
			runPostReminderJob(appInstance)
		})
		s.runJobs()
	}

	s.doAppMigrations()

	s.initPostMetadata()

	// Dump the image cache if the proxy settings have changed. (need switch URLs to the correct proxy)
	s.platform.AddConfigListener(func(oldCfg, newCfg *model.Config) {
		if (oldCfg.ImageProxySettings.Enable != newCfg.ImageProxySettings.Enable) ||
			(oldCfg.ImageProxySettings.ImageProxyType != newCfg.ImageProxySettings.ImageProxyType) ||
			(oldCfg.ImageProxySettings.RemoteImageProxyURL != newCfg.ImageProxySettings.RemoteImageProxyURL) ||
			(oldCfg.ImageProxySettings.RemoteImageProxyOptions != newCfg.ImageProxySettings.RemoteImageProxyOptions) {
			s.openGraphDataCache.Purge()
		}
	})

	return s, nil
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
		go complianceI.StartComplianceDailyJob()
	}

	if *s.platform.Config().JobSettings.RunJobs && s.Jobs != nil {
		if err := s.Jobs.StartWorkers(); err != nil {
			mlog.Error("Failed to start job server workers", mlog.Err(err))
		}
	}
	if *s.platform.Config().JobSettings.RunScheduler && s.Jobs != nil {
		if err := s.Jobs.StartSchedulers(); err != nil {
			mlog.Error("Failed to start job server schedulers", mlog.Err(err))
		}
	}

	if *s.platform.Config().ServiceSettings.EnableAWSMetering {
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
	schemaVersion, _ := s.Store().GetDBSchemaVersion()
	return *s.platform.Config().SqlSettings.DriverName, strconv.Itoa(schemaVersion)
}

func (s *Server) startInterClusterServices(license *model.License) error {
	if license == nil {
		mlog.Debug("No license provided; Remote Cluster services disabled")
		return nil
	}

	// Remote Cluster service

	// License check (assume enabled if shared channels enabled)
	if !license.HasRemoteClusterService() && !license.HasSharedChannels() {
		mlog.Debug("License does not have Remote Cluster services enabled")
		return nil
	}

	// Config check
	if !*s.platform.Config().ExperimentalSettings.EnableRemoteClusterService && !*s.platform.Config().ExperimentalSettings.EnableSharedChannels {
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

	// Shared Channels service (depends on remote cluster service)

	// License check
	if !license.HasSharedChannels() {
		mlog.Debug("License does not have shared channels enabled")
		return nil
	}

	// Config check
	if !*s.platform.Config().ExperimentalSettings.EnableSharedChannels {
		mlog.Debug("Shared Channels Service disabled via config")
		return nil
	}

	appInstance := New(ServerConnector(s.Channels()))
	scs, err := sharedchannel.NewSharedChannelService(s, appInstance)
	if err != nil {
		return err
	}
	s.platform.SetSharedChannelService(scs)

	if err = scs.Start(); err != nil {
		return err
	}

	s.serviceMux.Lock()
	s.sharedChannelService = scs
	s.serviceMux.Unlock()

	return nil
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
	s.Log().Info("Stopping Server...")

	defer sentry.Flush(2 * time.Second)

	s.RemoveLicenseListener(s.loggerLicenseListenerId)
	s.RemoveClusterLeaderChangedListener(s.clusterLeaderListenerId)

	if s.tracer != nil {
		if err := s.tracer.Close(); err != nil {
			s.Log().Warn("Unable to cleanly shutdown opentracing client", mlog.Err(err))
		}
	}

	err := s.telemetryService.Shutdown()
	if err != nil {
		s.Log().Warn("Unable to cleanly shutdown telemetry client", mlog.Err(err))
	}

	s.serviceMux.RLock()
	if s.sharedChannelService != nil {
		if err = s.sharedChannelService.Shutdown(); err != nil {
			s.Log().Error("Error shutting down shared channel services", mlog.Err(err))
		}
	}
	if s.remoteClusterService != nil {
		if err = s.remoteClusterService.Shutdown(); err != nil {
			s.Log().Error("Error shutting down intercluster services", mlog.Err(err))
		}
	}
	s.serviceMux.RUnlock()

	s.StopHTTPServer()
	s.stopLocalModeServer()
	// Push notification hub needs to be shutdown after HTTP server
	// to prevent stray requests from generating a push notification after it's shut down.
	s.StopPushNotificationsHubWorkers()
	s.htmlTemplateWatcher.Close()

	s.platform.StopSearchEngine()

	s.Audit.Shutdown()

	s.platform.StopFeatureFlagUpdateJob()

	if err = s.platform.ShutdownConfig(); err != nil {
		s.Log().Warn("Failed to shut down config store", mlog.Err(err))
	}

	if s.platform.Cluster() != nil {
		s.platform.Cluster().StopInterNodeCommunication()
	}

	if err = s.platform.ShutdownMetrics(); err != nil {
		s.Log().Warn("Failed to stop metrics server", mlog.Err(err))
	}

	// This must be done after the cluster is stopped.
	if s.Jobs != nil {
		// For simplicity we don't check if workers and schedulers are active
		// before stopping them as both calls essentially become no-ops
		// if nothing is running.
		if err = s.Jobs.StopWorkers(); err != nil && !errors.Is(err, jobs.ErrWorkersNotRunning) {
			s.Log().Warn("Failed to stop job server workers", mlog.Err(err))
		}
		if err = s.Jobs.StopSchedulers(); err != nil && !errors.Is(err, jobs.ErrSchedulersNotRunning) {
			s.Log().Warn("Failed to stop job server schedulers", mlog.Err(err))
		}
	}

	// Stop products.
	// This needs to happen last because products are dependent
	// on parent services.
	for name, product := range s.products {
		if err2 := product.Stop(); err2 != nil {
			s.Log().Warn("Unable to cleanly stop product", mlog.String("name", name), mlog.Err(err2))
		}
	}

	if err = s.platform.Shutdown(); err != nil {
		s.Log().Warn("Failed to stop platform", mlog.Err(err))
	}

	s.Log().Info("Server stopped")

	// shutdown main and notification loggers which will flush any remaining log records.
	timeoutCtx, timeoutCancel := context.WithTimeout(context.Background(), time.Second*15)
	defer timeoutCancel()
	if err = s.NotificationsLog().ShutdownWithTimeout(timeoutCtx); err != nil {
		fmt.Fprintf(os.Stderr, "Error shutting down notification logger: %v", err)
	}
	if err = s.Log().ShutdownWithTimeout(timeoutCtx); err != nil {
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

func (s *Server) CanIUpgradeToE0() error {
	return upgrader.CanIUpgradeToE0()
}

func (s *Server) UpgradeToE0() error {
	if err := upgrader.UpgradeToE0(); err != nil {
		return err
	}
	upgradedFromTE := &model.System{Name: model.SystemUpgradedFromTeId, Value: "true"}
	s.Store().System().Save(upgradedFromTE)
	return nil
}

func (s *Server) UpgradeToE0Status() (int64, error) {
	return upgrader.UpgradeToE0Status()
}

// Go creates a goroutine, but maintains a record of it to ensure that execution completes before
// the server is shutdown.
func (s *Server) Go(f func()) {
	s.platform.Go(f)
}

// GoBuffered acts like a semaphore which creates a goroutine, but maintains a record of it
// to ensure that execution completes before the server is shutdown.
func (s *Server) GoBuffered(f func()) {
	s.platform.GoBuffered(f)
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

	// make sure channels starts first
	if err := s.products["channels"].Start(); err != nil {
		return errors.Wrap(err, "Unable to start channels")
	}
	for name, product := range s.products {
		if name == "channels" {
			continue
		}
		if err := product.Start(); err != nil {
			return errors.Wrapf(err, "Unable to start %s", name)
		}
	}

	if s.joinCluster && s.platform.Cluster() != nil {
		s.registerClusterHandlers()
		s.platform.Cluster().StartInterNodeCommunication()
	}

	if err := s.ensureInstallationDate(); err != nil {
		return errors.Wrapf(err, "unable to ensure installation date")
	}

	if err := s.ensureFirstServerRunTimestamp(); err != nil {
		return errors.Wrapf(err, "unable to ensure first run timestamp")
	}

	if err := s.Store().Status().ResetAll(); err != nil {
		mlog.Error("Error to reset the server status.", mlog.Err(err))
	}

	if s.MailServiceConfig().SendEmailNotifications {
		if err := mail.TestConnection(s.MailServiceConfig()); err != nil {
			mlog.Error("Mail server connection test failed", mlog.Err(err))
		}
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

	s.platform.ReloadConfig()

	mlog.Info("Starting Server...")

	var handler http.Handler = s.RootRouter

	if *s.platform.Config().LogSettings.EnableDiagnostics && *s.platform.Config().LogSettings.EnableSentry && !strings.Contains(SentryDSN, "placeholder") {
		sentryHandler := sentryhttp.New(sentryhttp.Options{
			Repanic: true,
		})
		handler = sentryHandler.Handle(handler)
	}

	if allowedOrigins := *s.platform.Config().ServiceSettings.AllowCorsFrom; allowedOrigins != "" {
		exposedCorsHeaders := *s.platform.Config().ServiceSettings.CorsExposedHeaders
		allowCredentials := *s.platform.Config().ServiceSettings.CorsAllowCredentials
		debug := *s.platform.Config().ServiceSettings.CorsDebug
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
			corsWrapper.Log = s.Log().With(mlog.String("source", "cors")).StdLogger(mlog.LvlDebug)
		}

		handler = corsWrapper.Handler(handler)
	}

	if *s.platform.Config().RateLimitSettings.Enable {
		mlog.Info("RateLimiter is enabled")

		rateLimiter, err2 := NewRateLimiter(&s.platform.Config().RateLimitSettings, s.platform.Config().ServiceSettings.TrustedProxyIPHeader)
		if err2 != nil {
			return err2
		}

		s.RateLimiter = rateLimiter
		handler = rateLimiter.RateLimitHandler(handler)
	}

	// Creating a logger for logging errors from http.Server at error level
	errStdLog := s.Log().With(mlog.String("source", "httpserver")).StdLogger(mlog.LvlError)

	s.Server = &http.Server{
		Handler:      handler,
		ReadTimeout:  time.Duration(*s.platform.Config().ServiceSettings.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(*s.platform.Config().ServiceSettings.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(*s.platform.Config().ServiceSettings.IdleTimeout) * time.Second,
		ErrorLog:     errStdLog,
	}

	addr := *s.platform.Config().ServiceSettings.ListenAddress
	if addr == "" {
		if *s.platform.Config().ServiceSettings.ConnectionSecurity == model.ConnSecurityTLS {
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
		Cache:  autocert.DirCache(*s.platform.Config().ServiceSettings.LetsEncryptCertificateCacheFile),
		Prompt: autocert.AcceptTOS,
	}

	if *s.platform.Config().ServiceSettings.Forward80To443 {
		if host, port, err := net.SplitHostPort(addr); err != nil {
			mlog.Error("Unable to setup forwarding", mlog.Err(err))
		} else if port != "443" {
			return fmt.Errorf(i18n.T("api.server.start_server.forward80to443.enabled_but_listening_on_wrong_port"), port)
		} else {
			httpListenAddress := net.JoinHostPort(host, "http")

			if *s.platform.Config().ServiceSettings.UseLetsEncrypt {
				server := &http.Server{
					Addr:     httpListenAddress,
					Handler:  m.HTTPHandler(nil),
					ErrorLog: s.Log().With(mlog.String("source", "le_forwarder_server")).StdLogger(mlog.LvlError),
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
						ErrorLog: s.Log().With(mlog.String("source", "forwarder_server")).StdLogger(mlog.LvlError),
					}
					server.Serve(redirectListener)
				}()
			}
		}
	} else if *s.platform.Config().ServiceSettings.UseLetsEncrypt {
		return errors.New(i18n.T("api.server.start_server.forward80to443.disabled_while_using_lets_encrypt"))
	}

	s.didFinishListen = make(chan struct{})
	go func() {
		var err error
		if *s.platform.Config().ServiceSettings.ConnectionSecurity == model.ConnSecurityTLS {

			tlsConfig := &tls.Config{
				PreferServerCipherSuites: true,
				CurvePreferences:         []tls.CurveID{tls.CurveP521, tls.CurveP384, tls.CurveP256},
			}

			switch *s.platform.Config().ServiceSettings.TLSMinVer {
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

			if len(s.platform.Config().ServiceSettings.TLSOverwriteCiphers) == 0 {
				tlsConfig.CipherSuites = defaultCiphers
			} else {
				var cipherSuites []uint16
				for _, cipher := range s.platform.Config().ServiceSettings.TLSOverwriteCiphers {
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

			if *s.platform.Config().ServiceSettings.UseLetsEncrypt {
				tlsConfig.GetCertificate = m.GetCertificate
				tlsConfig.NextProtos = append(tlsConfig.NextProtos, "h2")
			} else {
				certFile = *s.platform.Config().ServiceSettings.TLSCertFile
				keyFile = *s.platform.Config().ServiceSettings.TLSKeyFile
			}

			s.Server.TLSConfig = tlsConfig
			err = s.Server.ServeTLS(listener, certFile, keyFile)
		} else {
			err = s.Server.Serve(listener)
		}

		if err != nil && err != http.ErrServerClosed {
			mlog.Fatal("Error starting server", mlog.Err(err))
			time.Sleep(time.Second)
		}

		close(s.didFinishListen)
	}()

	if *s.platform.Config().ServiceSettings.EnableLocalMode {
		if err := s.startLocalModeServer(); err != nil {
			mlog.Fatal(err.Error())
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

	socket := *s.platform.Config().ServiceSettings.LocalModeSocketLocation
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
			mlog.Fatal("Error starting unix socket server", mlog.Err(err))
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

	// Overriding the default origin checker
	return func(r *http.Request) bool {
		origin := r.Header["Origin"]
		if len(origin) == 0 {
			return true
		}
		if origin[0] == "null" {
			return false
		}
		u, err := url.Parse(origin[0])
		if err != nil {
			return false
		}

		// To maintain the case where siteURL is not set.
		if *a.Config().ServiceSettings.SiteURL == "" {
			return strings.EqualFold(u.Host, r.Host)
		}
		siteURL, err := url.Parse(*a.Config().ServiceSettings.SiteURL)
		if err != nil {
			return false
		}
		return strings.EqualFold(u.Host, siteURL.Host) && strings.EqualFold(u.Scheme, siteURL.Scheme)
	}
}

func (s *Server) checkPushNotificationServerURL() {
	notificationServer := *s.platform.Config().EmailSettings.PushNotificationServer
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
	awsMeter := awsmeter.New(s.Store(), s.platform.Config())
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

	s.Store().Token().Cleanup(expiry)
}

func doCommandWebhookCleanup(s *Server) {
	s.Store().CommandWebhook().Cleanup()
}

const (
	sessionsCleanupBatchSize = 1000
	jobsCleanupBatchSize     = 1000
)

func doSessionCleanup(s *Server) {
	mlog.Debug("Cleaning up session store.")
	err := s.Store().Session().Cleanup(model.GetMillis(), sessionsCleanupBatchSize)
	if err != nil {
		mlog.Warn("Error while cleaning up sessions", mlog.Err(err))
	}
}

func doJobsCleanup(s *Server) {
	if *s.platform.Config().JobSettings.CleanupJobsThresholdDays < 0 {
		return
	}
	mlog.Debug("Cleaning up jobs store.")

	dur := time.Duration(*s.platform.Config().JobSettings.CleanupJobsThresholdDays) * time.Hour * 24
	expiry := model.GetMillisForTime(time.Now().Add(-dur))
	err := s.Store().Job().Cleanup(expiry, jobsCleanupBatchSize)
	if err != nil {
		mlog.Warn("Error while cleaning up jobs", mlog.Err(err))
	}
}

func doConfigCleanup(s *Server) {
	if *s.platform.Config().JobSettings.CleanupConfigThresholdDays < 0 || !config.IsDatabaseDSN(s.platform.DescribeConfig()) {
		return
	}
	mlog.Info("Cleaning up configuration store.")

	if err := s.platform.CleanUpConfig(); err != nil {
		mlog.Warn("Error while cleaning up configurations", mlog.Err(err))
	}
}

func (s *Server) HandleMetrics(route string, h http.Handler) {
	s.platform.HandleMetrics(route, h)
}

func (s *Server) sendLicenseUpForRenewalEmail(users map[string]*model.User, license *model.License) *model.AppError {
	key := model.LicenseUpForRenewalEmailSent + license.Id
	if _, err := s.Store().System().GetByName(key); err == nil {
		// return early because the key already exists and that means we already executed the code below to send email successfully
		return nil
	}

	daysToExpiration := license.DaysToExpiration()

	renewalLink, _, appErr := s.GenerateLicenseRenewalLink()
	if appErr != nil {
		return model.NewAppError("s.sendLicenseUpForRenewalEmail", "api.server.license_up_for_renewal.error_generating_link", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// we want to at least have one email sent out to an admin
	countNotOks := 0

	for _, user := range users {
		name := user.FirstName
		if name == "" {
			name = user.Username
		}
		if err := s.EmailService.SendLicenseUpForRenewalEmail(user.Email, name, user.Locale, *s.platform.Config().ServiceSettings.SiteURL, renewalLink, daysToExpiration); err != nil {
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

	if err := s.Store().System().Save(&system); err != nil {
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

	if license.IsCloud() {
		mlog.Debug("Skipping license expiration check for Cloud")
		return
	}

	users, err := s.Store().User().GetSystemAdminProfiles()
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
			if err := s.SendRemoveExpiredLicenseEmail(user.Email, renewalLink, user.Locale, *s.platform.Config().ServiceSettings.SiteURL); err != nil {
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
		return model.NewAppError("SendRemoveExpiredLicenseEmail", "api.license.remove_expired_license.failed.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (s *Server) FileBackend() filestore.FileBackend {
	return s.platform.FileBackend()
}

func (s *Server) TotalWebsocketConnections() int {
	return s.Platform().TotalWebsocketConnections()
}

func (s *Server) ClusterHealthScore() int {
	return s.platform.Cluster().HealthScore()
}

func (ch *Channels) ClientConfigHash() string {
	return ch.srv.Platform().ClientConfigHash()
}

func (s *Server) initJobs() {
	s.Jobs = jobs.NewJobServer(s.platform, s.Store(), s.GetMetrics())

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
		indexer.MakeWorker(s.Jobs, s.platform.SearchEngine.BleveEngine.(*bleveengine.BleveEngine)),
		nil,
	)

	s.Jobs.RegisterJobType(
		model.JobTypeMigrations,
		migrations.MakeWorker(s.Jobs, s.Store()),
		migrations.MakeScheduler(s.Jobs, s.Store()),
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
		import_delete.MakeWorker(s.Jobs, New(ServerConnector(s.Channels())), s.Store()),
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
		active_users.MakeWorker(s.Jobs, s.Store(), func() einterfaces.MetricsInterface { return s.GetMetrics() }),
		active_users.MakeScheduler(s.Jobs),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeResendInvitationEmail,
		resend_invitation_email.MakeWorker(s.Jobs, New(ServerConnector(s.Channels())), s.Store(), s.telemetryService),
		nil,
	)

	s.Jobs.RegisterJobType(
		model.JobTypeExtractContent,
		extract_content.MakeWorker(s.Jobs, New(ServerConnector(s.Channels())), s.Store()),
		nil,
	)

	s.Jobs.RegisterJobType(
		model.JobTypeLastAccessiblePost,
		last_accessible_post.MakeWorker(s.Jobs, s.License(), New(ServerConnector(s.Channels()))),
		last_accessible_post.MakeScheduler(s.Jobs, s.License()),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeLastAccessibleFile,
		last_accessible_file.MakeWorker(s.Jobs, s.License(), New(ServerConnector(s.Channels()))),
		last_accessible_file.MakeScheduler(s.Jobs, s.License()),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeUpgradeNotifyAdmin,
		notify_admin.MakeUpgradeNotifyWorker(s.Jobs, s.License(), New(ServerConnector(s.Channels()))),
		notify_admin.MakeScheduler(s.Jobs, s.License(), model.JobTypeUpgradeNotifyAdmin),
	)

	s.Jobs.RegisterJobType(
		model.JobTypeTrialNotifyAdmin,
		notify_admin.MakeTrialNotifyWorker(s.Jobs, s.License(), New(ServerConnector(s.Channels()))),
		notify_admin.MakeScheduler(s.Jobs, s.License(), model.JobTypeTrialNotifyAdmin),
	)

	s.platform.Jobs = s.Jobs
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

// GetStore returns the server's Store. Exposing via a method
// allows interfaces to be created with subsets of server APIs.
func (s *Server) GetStore() store.Store {
	return s.Store()
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
	if s.platform == nil {
		return nil
	}
	return s.platform.Metrics()
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
	s.platform.SetSharedChannelService(sharedChannelService)
}

func (s *Server) GetProfileImage(user *model.User) ([]byte, bool, *model.AppError) {
	if *s.platform.Config().FileSettings.DriverName == "" {
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
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.default_font.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		case errors.Is(err, users.UserInitialsError):
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.initial.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return nil, model.NewAppError("GetDefaultProfileImage", "api.user.create_profile_image.encode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return img, nil
}

func (s *Server) ReadFile(path string) ([]byte, *model.AppError) {
	result, nErr := s.FileBackend().ReadFile(path)
	if nErr != nil {
		return nil, model.NewAppError("ReadFile", "api.file.read_file.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return result, nil
}

func withMut(mut *sync.Mutex, f func()) {
	mut.Lock()
	defer mut.Unlock()
	f()
}

func cancelTask(mut *sync.Mutex, taskPointer **model.ScheduledTask) {
	mut.Lock()
	defer mut.Unlock()
	if *taskPointer != nil {
		(*taskPointer).Cancel()
		*taskPointer = nil
	}
}

func runDNDStatusExpireJob(a *App) {
	if a.IsLeader() {
		withMut(&a.ch.dndTaskMut, func() {
			a.ch.dndTask = model.CreateRecurringTaskFromNextIntervalTime("Unset DND Statuses", a.UpdateDNDStatusOfUsers, 5*time.Minute)
		})
	}
	a.ch.srv.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if unset DNS status task should be running", mlog.Bool("isLeader", a.IsLeader()))
		if a.IsLeader() {
			withMut(&a.ch.dndTaskMut, func() {
				a.ch.dndTask = model.CreateRecurringTaskFromNextIntervalTime("Unset DND Statuses", a.UpdateDNDStatusOfUsers, 5*time.Minute)
			})
		} else {
			cancelTask(&a.ch.dndTaskMut, &a.ch.dndTask)
		}
	})
}

func runPostReminderJob(a *App) {
	if a.IsLeader() {
		withMut(&a.ch.postReminderMut, func() {
			a.ch.postReminderTask = model.CreateRecurringTaskFromNextIntervalTime("Check Post reminders", a.CheckPostReminders, 5*time.Minute)
		})
	}
	a.ch.srv.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if post reminder task should be running", mlog.Bool("isLeader", a.IsLeader()))
		if a.IsLeader() {
			withMut(&a.ch.postReminderMut, func() {
				a.ch.postReminderTask = model.CreateRecurringTaskFromNextIntervalTime("Check Post reminders", a.CheckPostReminders, 5*time.Minute)
			})
		} else {
			cancelTask(&a.ch.postReminderMut, &a.ch.postReminderTask)
		}
	})
}

func (a *App) GetAppliedSchemaMigrations() ([]model.AppliedMigration, *model.AppError) {
	table, err := a.Srv().Store().GetAppliedMigrations()
	if err != nil {
		return nil, model.NewAppError("GetDBSchemaTable", "api.file.read_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return table, nil
}

// Expose platform service from server, this should be replaced with server itself in time.
func (s *Server) Platform() *platform.PlatformService {
	return s.platform
}

func (s *Server) Log() *mlog.Logger {
	return s.platform.Logger()
}

func (s *Server) NotificationsLog() *mlog.Logger {
	return s.platform.NotificationsLogger()
}
