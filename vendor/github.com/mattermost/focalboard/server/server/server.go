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

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/focalboard/server/api"
	"github.com/mattermost/focalboard/server/app"
	"github.com/mattermost/focalboard/server/auth"
	appModel "github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/metrics"
	"github.com/mattermost/focalboard/server/services/scheduler"
	"github.com/mattermost/focalboard/server/services/store"
	"github.com/mattermost/focalboard/server/services/store/mattermostauthlayer"
	"github.com/mattermost/focalboard/server/services/store/sqlstore"
	"github.com/mattermost/focalboard/server/services/telemetry"
	"github.com/mattermost/focalboard/server/services/webhook"
	"github.com/mattermost/focalboard/server/web"
	"github.com/mattermost/focalboard/server/ws"
	"github.com/oklog/run"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"

	"github.com/mattermost/mattermost-server/v6/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/utils"
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
	logger                 *mlog.Logger
	cleanUpSessionsTask    *scheduler.ScheduledTask
	metricsServer          *metrics.Service
	metricsService         *metrics.Metrics
	metricsUpdaterTask     *scheduler.ScheduledTask
	auditService           *audit.Audit
	servicesStartStopMutex sync.Mutex

	localRouter     *mux.Router
	localModeServer *http.Server
	api             *api.API
}

func New(cfg *config.Configuration, singleUserToken string, db store.Store,
	logger *mlog.Logger, serverID string, wsAdapter ws.Adapter) (*Server, error) {
	authenticator := auth.New(cfg, db)

	// if no ws adapter is provided, we spin up a websocket server
	if wsAdapter == nil {
		wsAdapter = ws.NewServer(authenticator, singleUserToken, cfg.AuthMode == MattermostAuthMod, logger)
	}

	filesBackendSettings := filestore.FileBackendSettings{}
	filesBackendSettings.DriverName = cfg.FilesDriver
	filesBackendSettings.Directory = cfg.FilesPath
	filesBackendSettings.AmazonS3AccessKeyId = cfg.FilesS3Config.AccessKeyID
	filesBackendSettings.AmazonS3SecretAccessKey = cfg.FilesS3Config.SecretAccessKey
	filesBackendSettings.AmazonS3Bucket = cfg.FilesS3Config.Bucket
	filesBackendSettings.AmazonS3PathPrefix = cfg.FilesS3Config.PathPrefix
	filesBackendSettings.AmazonS3Region = cfg.FilesS3Config.Region
	filesBackendSettings.AmazonS3Endpoint = cfg.FilesS3Config.Endpoint
	filesBackendSettings.AmazonS3SSL = cfg.FilesS3Config.SSL
	filesBackendSettings.AmazonS3SignV2 = cfg.FilesS3Config.SignV2
	filesBackendSettings.AmazonS3SSE = cfg.FilesS3Config.SSE
	filesBackendSettings.AmazonS3Trace = cfg.FilesS3Config.Trace

	filesBackend, appErr := filestore.NewFileBackend(filesBackendSettings)
	if appErr != nil {
		logger.Error("Unable to initialize the files storage", mlog.Err(appErr))

		return nil, errors.New("unable to initialize the files storage")
	}

	webhookClient := webhook.NewClient(cfg, logger)

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
	if err := auditService.Configure(cfg.AuditCfgFile, cfg.AuditCfgJSON); err != nil {
		return nil, fmt.Errorf("unable to initialize the audit service: %w", err)
	}

	appServices := app.Services{
		Auth:         authenticator,
		Store:        db,
		FilesBackend: filesBackend,
		Webhook:      webhookClient,
		Metrics:      metricsService,
		Logger:       logger,
	}
	app := app.New(cfg, wsAdapter, appServices)

	focalboardAPI := api.NewAPI(app, singleUserToken, cfg.AuthMode, logger, auditService)

	// Local router for admin APIs
	localRouter := mux.NewRouter()
	focalboardAPI.RegisterAdminRoutes(localRouter)

	// Init workspace
	if _, err := app.GetRootWorkspace(); err != nil {
		logger.Error("Unable to get root workspace", mlog.Err(err))
		return nil, err
	}

	webServer := web.NewServer(cfg.WebPath, cfg.ServerRoot, cfg.Port, cfg.UseSSL, cfg.LocalOnly, logger)
	// if the adapter is a routed service, register it before the API
	if routedService, ok := wsAdapter.(web.RoutedService); ok {
		webServer.AddRoutes(routedService)
	}
	webServer.AddRoutes(focalboardAPI)

	settings, err := db.GetSystemSettings()
	if err != nil {
		return nil, err
	}

	// Init telemetry
	telemetryID := settings["TelemetryID"]
	if len(telemetryID) == 0 {
		telemetryID = uuid.New().String()
		if err = db.SetSystemSetting("TelemetryID", uuid.New().String()); err != nil {
			return nil, err
		}
	}
	telemetryOpts := telemetryOptions{
		app:         app,
		cfg:         cfg,
		telemetryID: telemetryID,
		serverID:    serverID,
		logger:      logger,
		singleUser:  len(singleUserToken) > 0,
	}
	telemetryService := initTelemetry(telemetryOpts)

	server := Server{
		config:         cfg,
		wsAdapter:      wsAdapter,
		webServer:      webServer,
		store:          db,
		filesBackend:   filesBackend,
		telemetry:      telemetryService,
		metricsServer:  metrics.NewMetricsServer(cfg.PrometheusAddress, metricsService, logger),
		metricsService: metricsService,
		auditService:   auditService,
		logger:         logger,
		localRouter:    localRouter,
		api:            focalboardAPI,
	}

	server.initHandlers()

	return &server, nil
}

func (s *Server) WSAdapter() ws.Adapter {
	return s.wsAdapter
}

func NewStore(config *config.Configuration, logger *mlog.Logger) (store.Store, error) {
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

	var db store.Store
	db, err = sqlstore.New(config.DBType, config.DBConfigString, config.DBTablePrefix, logger, sqlDB)
	if err != nil {
		return nil, err
	}
	if config.AuthMode == MattermostAuthMod {
		layeredStore, err2 := mattermostauthlayer.New(config.DBType, db.(*sqlstore.SQLStore).DBHandle(), db, logger)
		if err2 != nil {
			return nil, err2
		}
		db = layeredStore
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
		workspaceCount, err := s.store.GetWorkspaceCount()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "workspaces"), mlog.Err(err))
			return
		}
		s.logger.Log(mlog.LvlFBMetrics, "Workspace metrics collected", mlog.Int64("workspace_count", workspaceCount))
		s.metricsService.ObserveWorkspaceCount(workspaceCount)
	}
	// metricsUpdater()   Calling this immediately causes integration unit tests to fail.
	s.metricsUpdaterTask = scheduler.CreateRecurringTask("updateMetrics", metricsUpdater, updateMetricsTaskFrequency)

	if s.config.Telemetry {
		firstRun := utils.MillisFromTime(time.Now())
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

	defer s.logger.Info("Server.Shutdown")

	return s.store.Shutdown()
}

func (s *Server) Config() *config.Configuration {
	return s.config
}

func (s *Server) Logger() *mlog.Logger {
	return s.logger
}

// Local server

func (s *Server) startLocalModeServer() error {
	s.localModeServer = &http.Server{
		Handler:     s.localRouter,
		ConnContext: api.SetContextConn,
	}

	// TODO: Close and delete socket file on shutdown
	if err := syscall.Unlink(s.config.LocalModeSocketLocation); err != nil {
		s.logger.Error("Unable to unlink socket.", mlog.Err(err))
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
	logger      *mlog.Logger
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
			"serverRoot":  opts.cfg.ServerRoot == config.DefaultServerRoot,
			"port":        opts.cfg.Port == config.DefaultPort,
			"useSSL":      opts.cfg.UseSSL,
			"dbType":      opts.cfg.DBType,
			"single_user": opts.singleUser,
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
	telemetryService.RegisterTracker("workspaces", func() (telemetry.Tracker, error) {
		count, err := opts.app.GetWorkspaceCount()
		if err != nil {
			return nil, err
		}
		m := map[string]interface{}{
			"workspaces": count,
		}
		return m, nil
	})
	return telemetryService
}
