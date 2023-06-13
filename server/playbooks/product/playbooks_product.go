// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	mmapp "github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/product"
	"github.com/mattermost/mattermost/server/v8/playbooks/product/pluginapi/cluster"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/api"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/bot"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/command"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/config"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/enterprise"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/metrics"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/playbooks"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/scheduler"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/sqlstore"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/telemetry"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const (
	playbooksProductName = "playbooks"
	playbooksProductID   = "playbooks"
)

const (
	updateMetricsTaskFrequency = 15 * time.Minute

	metricsExposePort = ":9093"

	// Topic represents a start of a thread. In playbooks we support 2 types of topics:
	// status topic - indicating the start of the thread below status update and
	// task topic - indicating the start of the thread below task(checklist item)
	TopicTypeStatus = "status"
	TopicTypeTask   = "task"

	// Collection is a group of topics and their corresponding threads.
	// In Playbooks we support a single type of collection - a run
	CollectionTypeRun = "run"
)

const ServerKey product.ServiceKey = "server"

const (
	rudderDataplaneURL = "https://pdat.matterlytics.com"
	rudderKeyProd      = "1ag0Mv7LPf5uJNhcnKomqg0ENFd"
	rudderKeyTest      = "1Zu3mOF6U6M9zeaJsfmmhYigWLt"

	// These are placeholders to allow the existing release pipelines to run without failing to
	// insert the values that are now hard-coded above. Remove this once we converge on the
	// unified delivery pipeline in GitHub.
	_ = "placeholder_rudder_dataplane_url"
	_ = "placeholder_playbooks_rudder_key"
)

var errServiceTypeAssert = errors.New("type assertion failed")

type TelemetryClient interface {
	app.PlaybookRunTelemetry
	app.PlaybookTelemetry
	app.GenericTelemetry
	bot.Telemetry
	app.UserInfoTelemetry
	app.ChannelActionTelemetry
	app.CategoryTelemetry
	Enable() error
	Disable() error
}

func init() {
	product.RegisterProduct(playbooksProductName, product.Manifest{
		Initializer: newPlaybooksProduct,
		Dependencies: map[product.ServiceKey]struct{}{
			product.TeamKey:          {},
			product.ChannelKey:       {},
			product.UserKey:          {},
			product.PostKey:          {},
			product.BotKey:           {},
			product.ClusterKey:       {},
			product.ConfigKey:        {},
			product.LogKey:           {},
			product.LicenseKey:       {},
			product.FilestoreKey:     {},
			product.FileInfoStoreKey: {},
			product.RouterKey:        {},
			product.CloudKey:         {},
			product.KVStoreKey:       {},
			product.StoreKey:         {},
			product.SystemKey:        {},
			product.PreferencesKey:   {},
			product.SessionKey:       {},
			product.FrontendKey:      {},
			product.CommandKey:       {},
			product.ThreadsKey:       {},
		},
	})
}

type playbooksProduct struct {
	server               *mmapp.Server
	teamService          product.TeamService
	channelService       product.ChannelService
	userService          product.UserService
	postService          product.PostService
	permissionsService   product.PermissionService
	botService           product.BotService
	clusterService       product.ClusterService
	configService        product.ConfigService
	logger               mlog.LoggerIFace
	licenseService       product.LicenseService
	filestoreService     product.FilestoreService
	fileInfoStoreService product.FileInfoStoreService
	routerService        product.RouterService
	cloudService         product.CloudService
	kvStoreService       product.KVStoreService
	storeService         product.StoreService
	systemService        product.SystemService
	preferencesService   product.PreferencesService
	hooksService         product.HooksService
	sessionService       product.SessionService
	frontendService      product.FrontendService
	commandService       product.CommandService
	threadsService       product.ThreadsService

	handler              *api.Handler
	config               *config.ServiceImpl
	playbookRunService   app.PlaybookRunService
	playbookService      app.PlaybookService
	permissions          *app.PermissionsService
	channelActionService app.ChannelActionService
	categoryService      app.CategoryService
	bot                  *bot.Bot
	userInfoStore        app.UserInfoStore
	telemetryClient      TelemetryClient
	licenseChecker       app.LicenseChecker
	metricsService       *metrics.Metrics
	playbookStore        app.PlaybookStore
	playbookRunStore     app.PlaybookRunStore
	metricsServer        *metrics.Service
	metricsUpdaterTask   *scheduler.ScheduledTask

	serviceAdapter playbooks.ServicesAPI
}

func newPlaybooksProduct(services map[product.ServiceKey]interface{}) (product.Product, error) {
	playbooks := &playbooksProduct{}
	err := playbooks.setProductServices(services)
	if err != nil {
		return nil, err
	}

	playbooks.server = services[ServerKey].(*mmapp.Server)

	playbooks.serviceAdapter = newServiceAPIAdapter(playbooks)

	return playbooks, nil
}

func (pp *playbooksProduct) setProductServices(services map[product.ServiceKey]interface{}) error {
	for key, service := range services {
		switch key {
		case product.TeamKey:
			teamService, ok := service.(product.TeamService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.teamService = teamService
		case product.ChannelKey:
			channelService, ok := service.(product.ChannelService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.channelService = channelService
		case product.UserKey:
			userService, ok := service.(product.UserService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.userService = userService
		case product.PostKey:
			postService, ok := service.(product.PostService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.postService = postService
		case product.PermissionsKey:
			permissionsService, ok := service.(product.PermissionService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.permissionsService = permissionsService
		case product.BotKey:
			botService, ok := service.(product.BotService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.botService = botService
		case product.ClusterKey:
			clusterService, ok := service.(product.ClusterService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.clusterService = clusterService
		case product.ConfigKey:
			configService, ok := service.(product.ConfigService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.configService = configService
		case product.LogKey:
			logger, ok := service.(mlog.LoggerIFace)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.logger = logger.With(mlog.String("product", playbooksProductName))
		case product.LicenseKey:
			licenseService, ok := service.(product.LicenseService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.licenseService = licenseService
		case product.FilestoreKey:
			filestoreService, ok := service.(product.FilestoreService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.filestoreService = filestoreService
		case product.FileInfoStoreKey:
			fileInfoStoreService, ok := service.(product.FileInfoStoreService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.fileInfoStoreService = fileInfoStoreService
		case product.RouterKey:
			routerService, ok := service.(product.RouterService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.routerService = routerService
		case product.CloudKey:
			cloudService, ok := service.(product.CloudService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.cloudService = cloudService
		case product.KVStoreKey:
			kvStoreService, ok := service.(product.KVStoreService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.kvStoreService = kvStoreService
		case product.StoreKey:
			storeService, ok := service.(product.StoreService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.storeService = storeService
		case product.SystemKey:
			systemService, ok := service.(product.SystemService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.systemService = systemService
		case product.PreferencesKey:
			preferencesService, ok := service.(product.PreferencesService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.preferencesService = preferencesService
		case product.HooksKey:
			hooksService, ok := service.(product.HooksService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.hooksService = hooksService
		case product.SessionKey:
			sessionService, ok := service.(product.SessionService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.sessionService = sessionService
		case product.FrontendKey:
			frontendService, ok := service.(product.FrontendService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.frontendService = frontendService
		case product.CommandKey:
			commandService, ok := service.(product.CommandService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.commandService = commandService
		case product.ThreadsKey:
			threadsService, ok := service.(product.ThreadsService)
			if !ok {
				return fmt.Errorf("invalid service key '%s': %w", key, errServiceTypeAssert)
			}
			pp.threadsService = threadsService
		}
	}
	return nil
}

func (pp *playbooksProduct) Start() error {
	logger := logrus.StandardLogger()
	ConfigureLogrus(logger, pp.logger)

	botID, err := pp.serviceAdapter.EnsureBot(&model.Bot{
		Username:    "playbooks",
		DisplayName: "Playbooks",
		Description: "Playbooks bot.",
		OwnerId:     "playbooks",
	})
	if err != nil {
		return errors.Wrapf(err, "failed to ensure bot")
	}

	pp.config = config.NewConfigService(pp.serviceAdapter)
	err = pp.config.UpdateConfiguration(func(c *config.Configuration) {
		c.BotUserID = botID
		c.AdminLogLevel = "debug"
	})
	if err != nil {
		return errors.Wrapf(err, "failed save bot to config")
	}

	pp.handler = api.NewHandler(pp.config)

	rudderWriteKey := ""
	switch model.GetServiceEnvironment() {
	case model.ServiceEnvironmentProduction:
		rudderWriteKey = rudderKeyProd
	case model.ServiceEnvironmentTest:
		rudderWriteKey = rudderKeyTest
	case model.ServiceEnvironmentDev:
	}

	if rudderWriteKey == "" {
		logrus.Warn("Rudder credentials are not set. Disabling analytics.")
		pp.telemetryClient = &telemetry.NoopTelemetry{}
	} else {
		logrus.Info("Rudder credentials are set. Enabling analytics.")
		diagnosticID := pp.serviceAdapter.GetDiagnosticID()
		serverVersion := pp.serviceAdapter.GetServerVersion()
		pp.telemetryClient, err = telemetry.NewRudder(rudderDataplaneURL, rudderWriteKey, diagnosticID, serverVersion)
		if err != nil {
			return errors.Wrapf(err, "failed init telemetry client")
		}
	}

	toggleTelemetry := func() {
		diagnosticsFlag := pp.serviceAdapter.GetConfig().LogSettings.EnableDiagnostics
		telemetryEnabled := diagnosticsFlag != nil && *diagnosticsFlag

		if telemetryEnabled {
			if err = pp.telemetryClient.Enable(); err != nil {
				logrus.WithError(err).Error("Telemetry could not be enabled")
			}
			return
		}

		if err = pp.telemetryClient.Disable(); err != nil {
			logrus.WithError(err).Error("Telemetry could not be disabled")
		}
	}

	toggleTelemetry()
	pp.config.RegisterConfigChangeListener(toggleTelemetry)

	apiClient := sqlstore.NewClient(pp.serviceAdapter)
	pp.bot = bot.New(pp.serviceAdapter, pp.config.GetConfiguration().BotUserID, pp.config, pp.telemetryClient)
	scheduler := cluster.GetJobOnceScheduler(pp.serviceAdapter)

	sqlStore, err := sqlstore.New(apiClient, scheduler)
	if err != nil {
		return errors.Wrapf(err, "failed creating the SQL store")
	}

	pp.playbookRunStore = sqlstore.NewPlaybookRunStore(apiClient, sqlStore)
	pp.playbookStore = sqlstore.NewPlaybookStore(apiClient, sqlStore)
	statsStore := sqlstore.NewStatsStore(apiClient, sqlStore)
	pp.userInfoStore = sqlstore.NewUserInfoStore(sqlStore)
	channelActionStore := sqlstore.NewChannelActionStore(apiClient, sqlStore)
	categoryStore := sqlstore.NewCategoryStore(apiClient, sqlStore)

	pp.handler = api.NewHandler(pp.config)

	pp.playbookService = app.NewPlaybookService(pp.playbookStore, pp.bot, pp.telemetryClient, pp.serviceAdapter, pp.metricsService)

	keywordsThreadIgnorer := app.NewKeywordsThreadIgnorer()
	pp.channelActionService = app.NewChannelActionsService(pp.serviceAdapter, pp.bot, pp.config, channelActionStore, pp.playbookService, keywordsThreadIgnorer, pp.telemetryClient)
	pp.categoryService = app.NewCategoryService(categoryStore, pp.serviceAdapter, pp.telemetryClient)

	pp.licenseChecker = enterprise.NewLicenseChecker(pp.serviceAdapter)

	pp.playbookRunService = app.NewPlaybookRunService(
		pp.playbookRunStore,
		pp.bot,
		pp.config,
		scheduler,
		pp.telemetryClient,
		pp.telemetryClient,
		pp.serviceAdapter,
		pp.playbookService,
		pp.channelActionService,
		pp.licenseChecker,
		pp.metricsService,
	)

	if err = scheduler.SetCallback(pp.playbookRunService.HandleReminder); err != nil {
		logrus.WithError(err).Error("JobOnceScheduler could not add the playbookRunService's HandleReminder")
	}
	if err = scheduler.Start(); err != nil {
		logrus.WithError(err).Error("JobOnceScheduler could not start")
	}

	// Migrations use the scheduler, so they have to be run after playbookRunService and scheduler have started
	mutex, err := cluster.NewMutex(pp.serviceAdapter, "IR_dbMutex")
	if err != nil {
		return errors.Wrapf(err, "failed creating cluster mutex")
	}
	mutex.Lock()
	if err = sqlStore.RunMigrations(); err != nil {
		mutex.Unlock()
		return errors.Wrapf(err, "failed to run migrations")
	}
	mutex.Unlock()

	pp.permissions = app.NewPermissionsService(
		pp.playbookService,
		pp.playbookRunService,
		pp.serviceAdapter,
		pp.config,
		pp.licenseChecker,
	)

	// register collections and topics.
	// TODO bump the minimum server version
	if err = pp.serviceAdapter.RegisterCollectionAndTopic(CollectionTypeRun, TopicTypeStatus); err != nil {
		logrus.WithError(err).WithField("collection_type", CollectionTypeRun).WithField("topic_type", TopicTypeStatus).Warnf("failed to register collection and topic")
	}
	if err = pp.serviceAdapter.RegisterCollectionAndTopic(CollectionTypeRun, TopicTypeTask); err != nil {
		logrus.WithError(err).WithField("collection_type", CollectionTypeRun).WithField("topic_type", TopicTypeTask).Warnf("failed to register collection and topic")
	}

	api.NewGraphQLHandler(
		pp.handler.APIRouter,
		pp.playbookService,
		pp.playbookRunService,
		pp.categoryService,
		pp.serviceAdapter,
		pp.config,
		pp.permissions,
		pp.playbookStore,
		pp.licenseChecker,
	)
	api.NewPlaybookHandler(
		pp.handler.APIRouter,
		pp.playbookService,
		pp.serviceAdapter,
		pp.config,
		pp.permissions,
	)
	api.NewPlaybookRunHandler(
		pp.handler.APIRouter,
		pp.playbookRunService,
		pp.playbookService,
		pp.permissions,
		pp.licenseChecker,
		pp.serviceAdapter,
		pp.bot,
		pp.config,
	)
	api.NewStatsHandler(
		pp.handler.APIRouter,
		pp.serviceAdapter,
		statsStore,
		pp.playbookService,
		pp.permissions,
		pp.licenseChecker,
	)
	api.NewBotHandler(
		pp.handler.APIRouter,
		pp.serviceAdapter, pp.bot,
		pp.config,
		pp.playbookRunService,
		pp.userInfoStore,
	)
	api.NewTelemetryHandler(
		pp.handler.APIRouter,
		pp.playbookRunService,
		pp.serviceAdapter,
		pp.telemetryClient,
		pp.playbookService,
		pp.telemetryClient,
		pp.telemetryClient,
		pp.telemetryClient,
		pp.permissions,
	)
	api.NewSignalHandler(
		pp.handler.APIRouter,
		pp.serviceAdapter,
		pp.playbookRunService,
		pp.playbookService,
		keywordsThreadIgnorer,
	)
	api.NewSettingsHandler(
		pp.handler.APIRouter,
		pp.serviceAdapter,
		pp.config,
	)
	api.NewActionsHandler(
		pp.handler.APIRouter,
		pp.channelActionService,
		pp.serviceAdapter,
		pp.permissions,
	)
	api.NewCategoryHandler(
		pp.handler.APIRouter,
		pp.serviceAdapter,
		pp.categoryService,
		pp.playbookService,
		pp.playbookRunService,
	)

	isTestingEnabled := false
	flag := pp.serviceAdapter.GetConfig().ServiceSettings.EnableTesting
	if flag != nil {
		isTestingEnabled = *flag
	}

	if err = command.RegisterCommands(pp.serviceAdapter.RegisterCommand, isTestingEnabled); err != nil {
		return errors.Wrapf(err, "failed register commands")
	}

	if err := pp.hooksService.RegisterHooks(playbooksProductName, pp); err != nil {
		return fmt.Errorf("failed to register hooks: %w", err)
	}

	enableMetrics := pp.configService.Config().MetricsSettings.Enable
	if enableMetrics != nil && *enableMetrics {
		pp.metricsService = newMetricsInstance()
		// run metrics server to expose data
		pp.runMetricsServer()
		// run metrics updater recurring task
		pp.runMetricsUpdaterTask(pp.playbookStore, pp.playbookRunStore, updateMetricsTaskFrequency)
		// set error counter middleware handler
		pp.handler.APIRouter.Use(pp.getErrorCounterHandler())
	}

	pp.routerService.RegisterRouter(playbooksProductName, pp.handler.APIRouter)

	logrus.Debug("Playbooks product successfully started.")
	return nil
}

func (pp *playbooksProduct) Stop() error {
	if pp.metricsServer != nil {
		err := pp.metricsServer.Shutdown()
		if err != nil {
			logrus.WithError(err).Warn("unable to shut down metric server")
		}
	}
	if pp.metricsUpdaterTask != nil {
		pp.metricsUpdaterTask.Cancel()
	}
	return nil
}

func newMetricsInstance() *metrics.Metrics {
	// Init metrics
	instanceInfo := metrics.InstanceInfo{
		Version:        model.BuildHash,
		InstallationID: os.Getenv("MM_CLOUD_INSTALLATION_ID"),
	}
	return metrics.NewMetrics(instanceInfo)
}

func (pp *playbooksProduct) runMetricsServer() {
	logrus.WithField("port", metricsExposePort).Info("Starting Playbooks metrics server")

	pp.metricsServer = metrics.NewMetricsServer(metricsExposePort, pp.metricsService)
	// Run server to expose metrics
	go func() {
		err := pp.metricsServer.Run()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logrus.WithError(err).Error("Metrics server could not be started")
		}
	}()
}

func (pp *playbooksProduct) runMetricsUpdaterTask(playbookStore app.PlaybookStore, playbookRunStore app.PlaybookRunStore, updateMetricsTaskFrequency time.Duration) {
	metricsUpdater := func() {
		if playbooksActiveTotal, err := playbookStore.GetPlaybooksActiveTotal(); err == nil {
			pp.metricsService.ObservePlaybooksActiveTotal(playbooksActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, playbooks_active_total")
		}

		if runsActiveTotal, err := playbookRunStore.GetRunsActiveTotal(); err == nil {
			pp.metricsService.ObserveRunsActiveTotal(runsActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, runs_active_total")
		}

		if remindersOverdueTotal, err := playbookRunStore.GetOverdueUpdateRunsTotal(); err == nil {
			pp.metricsService.ObserveRemindersOutstandingTotal(remindersOverdueTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, reminders_outstanding_total")
		}

		if retrosOverdueTotal, err := playbookRunStore.GetOverdueRetroRunsTotal(); err == nil {
			pp.metricsService.ObserveRetrosOutstandingTotal(retrosOverdueTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, retros_outstanding_total")
		}

		if followersActiveTotal, err := playbookRunStore.GetFollowersActiveTotal(); err == nil {
			pp.metricsService.ObserveFollowersActiveTotal(followersActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, followers_active_total")
		}

		if participantsActiveTotal, err := playbookRunStore.GetParticipantsActiveTotal(); err == nil {
			pp.metricsService.ObserveParticipantsActiveTotal(participantsActiveTotal)
		} else {
			logrus.WithError(err).Error("error updating metrics, participants_active_total")
		}
	}

	pp.metricsUpdaterTask = scheduler.CreateRecurringTask("metricsUpdater", metricsUpdater, updateMetricsTaskFrequency)
}

func (pp *playbooksProduct) getErrorCounterHandler() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			recorder := &StatusRecorder{
				ResponseWriter: w,
				Status:         200,
			}
			next.ServeHTTP(recorder, r)
			if recorder.Status < 200 || recorder.Status > 299 {
				pp.metricsService.IncrementErrorsCount(1)
			}
		})
	}
}

type StatusRecorder struct {
	http.ResponseWriter
	Status int
}

func (r *StatusRecorder) WriteHeader(status int) {
	r.Status = status
	r.ResponseWriter.WriteHeader(status)
}

// ServeHTTP routes incoming HTTP requests to the plugin's REST API.
func (pp *playbooksProduct) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	pp.handler.ServeHTTP(w, r)
}

//
// These callbacks are called by the suite automatically
//

func (pp *playbooksProduct) OnConfigurationChange() error {
	if pp.config == nil {
		return nil
	}
	return pp.config.OnConfigurationChange()
}

// ExecuteCommand executes a command that has been previously registered via the RegisterCommand.
func (pp *playbooksProduct) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	runner := command.NewCommandRunner(c, args, pp.serviceAdapter, pp.bot,
		pp.playbookRunService, pp.playbookService, pp.config, pp.userInfoStore, pp.telemetryClient, pp.permissions)

	if err := runner.Execute(); err != nil {
		return nil, model.NewAppError("Playbooks.ExecuteCommand", "app.command.execute.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return &model.CommandResponse{}, nil
}

func (pp *playbooksProduct) UserHasJoinedChannel(c *plugin.Context, channelMember *model.ChannelMember, actor *model.User) {
	actorID := ""
	if actor != nil && actor.Id != channelMember.UserId {
		actorID = actor.Id
	}
	pp.channelActionService.UserHasJoinedChannel(channelMember.UserId, channelMember.ChannelId, actorID)
}

func (pp *playbooksProduct) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
	pp.channelActionService.MessageHasBeenPosted(post)
	pp.playbookRunService.MessageHasBeenPosted(post)
}

func (pp *playbooksProduct) UserHasPermissionToCollection(c *plugin.Context, userID string, collectionType, collectionID string, permission *model.Permission) (bool, error) {
	if collectionType != CollectionTypeRun {
		return false, errors.Errorf("collection %s is not registered by playbooks", collectionType)
	}

	run, err := pp.playbookRunService.GetPlaybookRun(collectionID)
	if err != nil {
		return false, errors.Wrapf(err, "No run with id - %s", collectionID)
	}
	return pp.permissions.HasPermissionsToRun(userID, run, permission), nil
}

func (pp *playbooksProduct) GetAllCollectionIDsForUser(c *plugin.Context, userID, collectionType string) ([]string, error) {
	if collectionType != CollectionTypeRun {
		return nil, errors.Errorf("collection %s is not registered by playbooks", collectionType)
	}

	ids, err := pp.playbookRunService.GetPlaybookRunIDsForUser(userID)
	if err != nil {
		return nil, err
	}

	return ids, nil
}

func (pp *playbooksProduct) GetAllUserIdsForCollection(c *plugin.Context, collectionType, collectionID string) ([]string, error) {
	if collectionType != CollectionTypeRun {
		return nil, errors.Errorf("collection %s is not registered by playbooks", collectionType)
	}

	run, err := pp.playbookRunService.GetPlaybookRun(collectionID)
	if err != nil {
		return nil, errors.Wrapf(err, "No run with id - %s", collectionID)
	}
	followers, err := pp.playbookRunService.GetFollowers(collectionID)
	if err != nil {
		return nil, errors.Wrapf(err, "can't get followers for run - %s", collectionID)
	}
	return mergeSlice(run.ParticipantIDs, followers), nil
}

func (pp *playbooksProduct) GetCollectionMetadataByIds(c *plugin.Context, collectionType string, collectionIDs []string) (map[string]*model.CollectionMetadata, error) {
	if collectionType != CollectionTypeRun {
		return nil, errors.Errorf("collection %s is not registered by playbooks", collectionType)
	}
	runsMetadata := map[string]*model.CollectionMetadata{}
	runs, err := pp.playbookRunService.GetRunMetadataByIDs(collectionIDs)
	if err != nil {
		return nil, errors.Wrap(err, "can't get playbook run metadata by ids")
	}
	for _, run := range runs {
		runsMetadata[run.ID] = &model.CollectionMetadata{
			Id:             run.ID,
			CollectionType: CollectionTypeRun,
			TeamId:         run.TeamID,
			Name:           run.Name,
			RelativeURL:    app.GetRunDetailsRelativeURL(run.ID),
		}
	}
	return runsMetadata, nil
}

func (pp *playbooksProduct) GetTopicMetadataByIds(c *plugin.Context, topicType string, topicIDs []string) (map[string]*model.TopicMetadata, error) {
	topicsMetadata := map[string]*model.TopicMetadata{}

	var getTopicMetadataByIDs func(topicIDs []string) ([]app.TopicMetadata, error)
	switch topicType {
	case TopicTypeStatus:
		getTopicMetadataByIDs = pp.playbookRunService.GetStatusMetadataByIDs
	case TopicTypeTask:
		getTopicMetadataByIDs = pp.playbookRunService.GetTaskMetadataByIDs
	default:
		return map[string]*model.TopicMetadata{}, errors.Errorf("topic type %s is not registered by playbooks", topicType)
	}

	topics, err := getTopicMetadataByIDs(topicIDs)
	if err != nil {
		return nil, errors.Wrap(err, "can't get metadata by topic ids")
	}
	for _, topic := range topics {
		topicsMetadata[topic.ID] = &model.TopicMetadata{
			Id:             topic.ID,
			TopicType:      topicType,
			CollectionType: CollectionTypeRun,
			TeamId:         topic.TeamID,
			CollectionId:   topic.RunID,
		}
	}

	return topicsMetadata, nil
}

func mergeSlice(a, b []string) []string {
	m := make(map[string]struct{}, len(a)+len(b))
	for _, elem := range a {
		m[elem] = struct{}{}
	}
	for _, elem := range b {
		m[elem] = struct{}{}
	}
	merged := make([]string, 0, len(m))
	for key := range m {
		merged = append(merged, key)
	}
	return merged
}
