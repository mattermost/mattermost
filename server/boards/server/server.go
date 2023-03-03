// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"database/sql"
	"fmt"
	"net"
	"net/http"
	"os"
	"runtime"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/oklog/run"

	"github.com/mattermost/mattermost-server/v6/boards/api"
	"github.com/mattermost/mattermost-server/v6/boards/app"
	"github.com/mattermost/mattermost-server/v6/boards/auth"
	appModel "github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/audit"
	"github.com/mattermost/mattermost-server/v6/boards/services/config"
	"github.com/mattermost/mattermost-server/v6/boards/services/metrics"
	"github.com/mattermost/mattermost-server/v6/boards/services/notify"
	"github.com/mattermost/mattermost-server/v6/boards/services/notify/notifylogger"
	"github.com/mattermost/mattermost-server/v6/boards/services/scheduler"
	"github.com/mattermost/mattermost-server/v6/boards/services/store"
	"github.com/mattermost/mattermost-server/v6/boards/services/store/sqlstore"
	"github.com/mattermost/mattermost-server/v6/boards/services/telemetry"
	"github.com/mattermost/mattermost-server/v6/boards/services/webhook"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
	"github.com/mattermost/mattermost-server/v6/boards/web"
	"github.com/mattermost/mattermost-server/v6/boards/ws"

	"github.com/mattermost/mattermost-server/v6/platform/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const (
	cleanupSessionTaskFrequency = 10 * time.Minute
	updateMetricsTaskFrequency  = 15 * time.Minute

	minSessionExpiryTime = int64(60 * 60 * 24 * 31) // 31 days

	MattermostAuthMod = "mattermost"
)

type Server struct {
	config                 *config.Configuration
	wsAdapter              ws.Adapter
	webServer              *web.Server
	store                  store.Store
	filesBackend           filestore.FileBackend
	telemetry              *telemetry.Service
	logger                 mlog.LoggerIFace
	cleanUpSessionsTask    *scheduler.ScheduledTask
	metricsServer          *metrics.Service
	metricsService         *metrics.Metrics
	metricsUpdaterTask     *scheduler.ScheduledTask
	auditService           *audit.Audit
	notificationService    *notify.Service
	servicesStartStopMutex sync.Mutex

	localRouter     *mux.Router
	localModeServer *http.Server
	api             *api.API
	app             *app.App
}

func New(params Params) (*Server, error) {
	if err := params.CheckValid(); err != nil {
		return nil, err
	}

	authenticator := auth.New(params.Cfg, params.DBStore, params.PermissionsService)

	// if no ws adapter is provided, we spin up a websocket server
	wsAdapter := params.WSAdapter
	if wsAdapter == nil {
		wsAdapter = ws.NewServer(authenticator, params.SingleUserToken, params.Cfg.AuthMode == MattermostAuthMod, params.Logger, params.DBStore)
	}

	filesBackendSettings := filestore.FileBackendSettings{}
	filesBackendSettings.DriverName = params.Cfg.FilesDriver
	filesBackendSettings.Directory = params.Cfg.FilesPath
	filesBackendSettings.AmazonS3AccessKeyId = params.Cfg.FilesS3Config.AccessKeyID
	filesBackendSettings.AmazonS3SecretAccessKey = params.Cfg.FilesS3Config.SecretAccessKey
	filesBackendSettings.AmazonS3Bucket = params.Cfg.FilesS3Config.Bucket
	filesBackendSettings.AmazonS3PathPrefix = params.Cfg.FilesS3Config.PathPrefix
	filesBackendSettings.AmazonS3Region = params.Cfg.FilesS3Config.Region
	filesBackendSettings.AmazonS3Endpoint = params.Cfg.FilesS3Config.Endpoint
	filesBackendSettings.AmazonS3SSL = params.Cfg.FilesS3Config.SSL
	filesBackendSettings.AmazonS3SignV2 = params.Cfg.FilesS3Config.SignV2
	filesBackendSettings.AmazonS3SSE = params.Cfg.FilesS3Config.SSE
	filesBackendSettings.AmazonS3Trace = params.Cfg.FilesS3Config.Trace
	filesBackendSettings.AmazonS3RequestTimeoutMilliseconds = params.Cfg.FilesS3Config.Timeout

	filesBackend, appErr := filestore.NewFileBackend(filesBackendSettings)
	if appErr != nil {
		params.Logger.Error("Unable to initialize the files storage", mlog.Err(appErr))

		return nil, errors.New("unable to initialize the files storage")
	}

	webhookClient := webhook.NewClient(params.Cfg, params.Logger)

	// Init metrics
	instanceInfo := metrics.InstanceInfo{
		Version:        appModel.CurrentVersion,
		BuildNum:       appModel.BuildNumber,
		Edition:        appModel.Edition,
		InstallationID: os.Getenv("MM_CLOUD_INSTALLATION_ID"),
	}
	metricsService := metrics.NewMetrics(instanceInfo)

	// Init audit
	auditService, errAudit := audit.NewAudit()
	if errAudit != nil {
		return nil, fmt.Errorf("unable to create the audit service: %w", errAudit)
	}
	if err := auditService.Configure(params.Cfg.AuditCfgFile, params.Cfg.AuditCfgJSON); err != nil {
		return nil, fmt.Errorf("unable to initialize the audit service: %w", err)
	}

	// Init notification services
	notificationService, errNotify := initNotificationService(params.NotifyBackends, params.Logger)
	if errNotify != nil {
		return nil, fmt.Errorf("cannot initialize notification service(s): %w", errNotify)
	}

	appServices := app.Services{
		Auth:             authenticator,
		Store:            params.DBStore,
		FilesBackend:     filesBackend,
		Webhook:          webhookClient,
		Metrics:          metricsService,
		Notifications:    notificationService,
		Logger:           params.Logger,
		Permissions:      params.PermissionsService,
		ServicesAPI:      params.ServicesAPI,
		SkipTemplateInit: utils.IsRunningUnitTests(),
	}
	app := app.New(params.Cfg, wsAdapter, appServices)

	focalboardAPI := api.NewAPI(app, params.SingleUserToken, params.Cfg.AuthMode, params.PermissionsService, params.Logger, auditService, params.IsPlugin)

	// Local router for admin APIs
	localRouter := mux.NewRouter()
	focalboardAPI.RegisterAdminRoutes(localRouter)

	// Init team
	if _, err := app.GetRootTeam(); err != nil {
		params.Logger.Error("Unable to get root team", mlog.Err(err))
		return nil, err
	}

	webServer := web.NewServer(params.Cfg.WebPath, params.Cfg.ServerRoot, params.Cfg.Port,
		params.Cfg.UseSSL, params.Cfg.LocalOnly, params.Logger)
	// if the adapter is a routed service, register it before the API
	if routedService, ok := wsAdapter.(web.RoutedService); ok {
		webServer.AddRoutes(routedService)
	}
	webServer.AddRoutes(focalboardAPI)

	settings, err := params.DBStore.GetSystemSettings()
	if err != nil {
		return nil, err
	}

	// Init telemetry
	telemetryID := settings["TelemetryID"]
	if len(telemetryID) == 0 {
		telemetryID = utils.NewID(utils.IDTypeNone)
		if err = params.DBStore.SetSystemSetting("TelemetryID", telemetryID); err != nil {
			return nil, err
		}
	}
	telemetryOpts := telemetryOptions{
		app:         app,
		cfg:         params.Cfg,
		telemetryID: telemetryID,
		serverID:    params.ServerID,
		logger:      params.Logger,
		singleUser:  len(params.SingleUserToken) > 0,
	}
	telemetryService := initTelemetry(telemetryOpts)

	server := Server{
		config:              params.Cfg,
		wsAdapter:           wsAdapter,
		webServer:           webServer,
		store:               params.DBStore,
		filesBackend:        filesBackend,
		telemetry:           telemetryService,
		metricsServer:       metrics.NewMetricsServer(params.Cfg.PrometheusAddress, metricsService, params.Logger),
		metricsService:      metricsService,
		auditService:        auditService,
		notificationService: notificationService,
		logger:              params.Logger,
		localRouter:         localRouter,
		api:                 focalboardAPI,
		app:                 app,
	}

	server.initHandlers()

	return &server, nil
}

func NewStore(config *config.Configuration, isSingleUser bool, logger mlog.LoggerIFace) (store.Store, error) {
	sqlDB, err := sql.Open(config.DBType, config.DBConfigString)
	if err != nil {
		logger.Error("connectDatabase failed", mlog.Err(err))
		return nil, err
	}

	err = sqlDB.Ping()
	if err != nil {
		logger.Error(`Database Ping failed`, mlog.Err(err))
		return nil, err
	}

	storeParams := sqlstore.Params{
		DBType:           config.DBType,
		ConnectionString: config.DBConfigString,
		TablePrefix:      config.DBTablePrefix,
		Logger:           logger,
		DB:               sqlDB,
		IsPlugin:         false,
		IsSingleUser:     isSingleUser,
	}

	var db store.Store
	db, err = sqlstore.New(storeParams)
	if err != nil {
		return nil, err
	}
	return db, nil
}

func (s *Server) Start() error {
	s.logger.Info("Server.Start")

	s.webServer.Start()

	s.servicesStartStopMutex.Lock()
	defer s.servicesStartStopMutex.Unlock()

	if s.config.EnableLocalMode {
		if err := s.startLocalModeServer(); err != nil {
			return err
		}
	}

	if s.config.AuthMode != MattermostAuthMod {
		s.cleanUpSessionsTask = scheduler.CreateRecurringTask("cleanUpSessions", func() {
			secondsAgo := minSessionExpiryTime
			if secondsAgo < s.config.SessionExpireTime {
				secondsAgo = s.config.SessionExpireTime
			}

			if err := s.store.CleanUpSessions(secondsAgo); err != nil {
				s.logger.Error("Unable to clean up the sessions", mlog.Err(err))
			}
		}, cleanupSessionTaskFrequency)
	}

	metricsUpdater := func() {
		blockCounts, err := s.store.GetBlockCountsByType()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "blocks"), mlog.Err(err))
			return
		}
		s.logger.Log(mlog.LvlFBMetrics, "Block metrics collected", mlog.Map("block_counts", blockCounts))
		for blockType, count := range blockCounts {
			s.metricsService.ObserveBlockCount(blockType, count)
		}
		boardCount, err := s.store.GetBoardCount()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "boards"), mlog.Err(err))
			return
		}
		s.logger.Log(mlog.LvlFBMetrics, "Board metrics collected", mlog.Int64("board_count", boardCount))
		s.metricsService.ObserveBoardCount(boardCount)
		teamCount, err := s.store.GetTeamCount()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "teams"), mlog.Err(err))
			return
		}
		s.logger.Log(mlog.LvlFBMetrics, "Team metrics collected", mlog.Int64("team_count", teamCount))
		s.metricsService.ObserveTeamCount(teamCount)
	}
	// metricsUpdater()   Calling this immediately causes integration unit tests to fail.
	s.metricsUpdaterTask = scheduler.CreateRecurringTask("updateMetrics", metricsUpdater, updateMetricsTaskFrequency)

	if s.config.Telemetry {
		firstRun := utils.GetMillis()
		s.telemetry.RunTelemetryJob(firstRun)
	}

	var group run.Group
	if s.config.PrometheusAddress != "" {
		group.Add(func() error {
			if err := s.metricsServer.Run(); err != nil {
				return errors.Wrap(err, "PromServer Run")
			}
			return nil
		}, func(error) {
			_ = s.metricsServer.Shutdown()
		})

		if err := group.Run(); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) Shutdown() error {
	if err := s.webServer.Shutdown(); err != nil {
		return err
	}

	s.stopLocalModeServer()

	s.servicesStartStopMutex.Lock()
	defer s.servicesStartStopMutex.Unlock()

	if s.cleanUpSessionsTask != nil {
		s.cleanUpSessionsTask.Cancel()
	}

	if s.metricsUpdaterTask != nil {
		s.metricsUpdaterTask.Cancel()
	}

	if err := s.telemetry.Shutdown(); err != nil {
		s.logger.Warn("Error occurred when shutting down telemetry", mlog.Err(err))
	}

	if err := s.auditService.Shutdown(); err != nil {
		s.logger.Warn("Error occurred when shutting down audit service", mlog.Err(err))
	}

	if err := s.notificationService.Shutdown(); err != nil {
		s.logger.Warn("Error occurred when shutting down notification service", mlog.Err(err))
	}

	s.app.Shutdown()

	defer s.logger.Info("Server.Shutdown")

	return s.store.Shutdown()
}

func (s *Server) Config() *config.Configuration {
	return s.config
}

func (s *Server) Logger() mlog.LoggerIFace {
	return s.logger
}

func (s *Server) App() *app.App {
	return s.app
}

func (s *Server) Store() store.Store {
	return s.store
}

func (s *Server) UpdateAppConfig() {
	s.app.SetConfig(s.config)
}

// Local server

func (s *Server) startLocalModeServer() error {
	s.localModeServer = &http.Server{ //nolint:gosec
		Handler:     s.localRouter,
		ConnContext: api.SetContextConn,
	}

	// TODO: Close and delete socket file on shutdown
	// Delete existing socket if it exists
	if _, err := os.Stat(s.config.LocalModeSocketLocation); err == nil {
		if err := syscall.Unlink(s.config.LocalModeSocketLocation); err != nil {
			s.logger.Error("Unable to unlink socket.", mlog.Err(err))
		}
	}

	socket := s.config.LocalModeSocketLocation
	unixListener, err := net.Listen("unix", socket)
	if err != nil {
		return err
	}
	if err = os.Chmod(socket, 0600); err != nil {
		return err
	}

	go func() {
		s.logger.Info("Starting unix socket server")
		err = s.localModeServer.Serve(unixListener)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.logger.Error("Error starting unix socket server", mlog.Err(err))
		}
	}()

	return nil
}

func (s *Server) stopLocalModeServer() {
	if s.localModeServer != nil {
		_ = s.localModeServer.Close()
		s.localModeServer = nil
	}
}

func (s *Server) GetRootRouter() *mux.Router {
	return s.webServer.Router()
}

type telemetryOptions struct {
	app         *app.App
	cfg         *config.Configuration
	telemetryID string
	serverID    string
	logger      mlog.LoggerIFace
	singleUser  bool
}

func initTelemetry(opts telemetryOptions) *telemetry.Service {
	telemetryService := telemetry.New(opts.telemetryID, opts.logger)

	telemetryService.RegisterTracker("server", func() (telemetry.Tracker, error) {
		return map[string]interface{}{
			"version":          appModel.CurrentVersion,
			"build_number":     appModel.BuildNumber,
			"build_hash":       appModel.BuildHash,
			"edition":          appModel.Edition,
			"operating_system": runtime.GOOS,
			"server_id":        opts.serverID,
		}, nil
	})
	telemetryService.RegisterTracker("config", func() (telemetry.Tracker, error) {
		return map[string]interface{}{
			"serverRoot":                 opts.cfg.ServerRoot == config.DefaultServerRoot,
			"port":                       opts.cfg.Port == config.DefaultPort,
			"useSSL":                     opts.cfg.UseSSL,
			"dbType":                     opts.cfg.DBType,
			"single_user":                opts.singleUser,
			"allow_public_shared_boards": opts.cfg.EnablePublicSharedBoards,
		}, nil
	})
	telemetryService.RegisterTracker("activity", func() (telemetry.Tracker, error) {
		m := make(map[string]interface{})
		var count int
		var err error
		if count, err = opts.app.GetRegisteredUserCount(); err != nil {
			return nil, err
		}
		m["registered_users"] = count

		if count, err = opts.app.GetDailyActiveUsers(); err != nil {
			return nil, err
		}
		m["daily_active_users"] = count

		if count, err = opts.app.GetWeeklyActiveUsers(); err != nil {
			return nil, err
		}
		m["weekly_active_users"] = count

		if count, err = opts.app.GetMonthlyActiveUsers(); err != nil {
			return nil, err
		}
		m["monthly_active_users"] = count
		return m, nil
	})
	telemetryService.RegisterTracker("blocks", func() (telemetry.Tracker, error) {
		blockCounts, err := opts.app.GetBlockCountsByType()
		if err != nil {
			return nil, err
		}
		m := make(map[string]interface{})
		for k, v := range blockCounts {
			m[k] = v
		}
		return m, nil
	})
	telemetryService.RegisterTracker("boards", func() (telemetry.Tracker, error) {
		boardCount, err := opts.app.GetBoardCount()
		if err != nil {
			return nil, err
		}
		m := map[string]interface{}{
			"boards": boardCount,
		}
		return m, nil
	})
	telemetryService.RegisterTracker("teams", func() (telemetry.Tracker, error) {
		count, err := opts.app.GetTeamCount()
		if err != nil {
			return nil, err
		}
		m := map[string]interface{}{
			"teams": count,
		}
		return m, nil
	})
	return telemetryService
}

func initNotificationService(backends []notify.Backend, logger mlog.LoggerIFace) (*notify.Service, error) {
	loggerBackend := notifylogger.New(logger, mlog.LvlDebug)

	backends = append(backends, loggerBackend)

	service, err := notify.New(logger, backends...)
	return service, err
}
