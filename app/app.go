// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"crypto/ecdsa"
	"fmt"
	"html/template"
	"net/http"
	"path"
	"reflect"
	"strconv"
	"sync"
	"sync/atomic"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/throttled/throttled"

	"github.com/mattermost/mattermost-server/einterfaces"
	ejobs "github.com/mattermost/mattermost-server/einterfaces/jobs"
	"github.com/mattermost/mattermost-server/jobs"
	tjobs "github.com/mattermost/mattermost-server/jobs/interfaces"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/services/httpservice"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/utils"
)

const ADVANCED_PERMISSIONS_MIGRATION_KEY = "AdvancedPermissionsMigrationComplete"
const EMOJIS_PERMISSIONS_MIGRATION_KEY = "EmojisPermissionsMigrationComplete"

type App struct {
	goroutineCount      int32
	goroutineExitSignal chan struct{}

	Srv *Server

	Log *mlog.Logger

	Plugins                *plugin.Environment
	PluginConfigListenerId string

	EmailBatching    *EmailBatchingJob
	EmailRateLimiter *throttled.GCRARateLimiter

	Hubs                        []*Hub
	HubsStopCheckingForDeadlock chan bool

	PushNotificationsHub PushNotificationsHub

	Jobs *jobs.JobServer

	AccountMigration einterfaces.AccountMigrationInterface
	Cluster          einterfaces.ClusterInterface
	Compliance       einterfaces.ComplianceInterface
	DataRetention    einterfaces.DataRetentionInterface
	Elasticsearch    einterfaces.ElasticsearchInterface
	Ldap             einterfaces.LdapInterface
	MessageExport    einterfaces.MessageExportInterface
	Metrics          einterfaces.MetricsInterface
	Mfa              einterfaces.MfaInterface
	Saml             einterfaces.SamlInterface

	config                 atomic.Value
	envConfig              map[string]interface{}
	configFile             string
	configListeners        map[string]func(*model.Config, *model.Config)
	clusterLeaderListeners sync.Map

	licenseValue       atomic.Value
	clientLicenseValue atomic.Value
	licenseListeners   map[string]func()

	timezones atomic.Value

	siteURL string

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
}

var appCount = 0

// New creates a new App. You must call Shutdown when you're done with it.
// XXX: For now, only one at a time is allowed as some resources are still shared.
func New(options ...Option) (outApp *App, outErr error) {
	appCount++
	if appCount > 1 {
		panic("Only one App should exist at a time. Did you forget to call Shutdown()?")
	}

	rootRouter := mux.NewRouter()

	app := &App{
		goroutineExitSignal: make(chan struct{}, 1),
		Srv: &Server{
			RootRouter: rootRouter,
		},
		sessionCache:     utils.NewLru(model.SESSION_CACHE_SIZE),
		configFile:       "config.json",
		configListeners:  make(map[string]func(*model.Config, *model.Config)),
		clientConfig:     make(map[string]string),
		licenseListeners: map[string]func(){},
	}

	app.HTTPService = httpservice.MakeHTTPService(app)

	app.CreatePushNotificationsHub()
	app.StartPushNotificationsHubWorkers()

	defer func() {
		if outErr != nil {
			app.Shutdown()
		}
	}()

	for _, option := range options {
		option(app)
	}

	if utils.T == nil {
		if err := utils.TranslationsPreInit(); err != nil {
			return nil, errors.Wrapf(err, "unable to load Mattermost translation files")
		}
	}
	model.AppErrorInit(utils.T)

	if err := app.LoadConfig(app.configFile); err != nil {
		return nil, err
	}

	// Initalize logging
	app.Log = mlog.NewLogger(utils.MloggerConfigFromLoggerConfig(&app.Config().LogSettings))

	// Redirect default golang logger to this logger
	mlog.RedirectStdLog(app.Log)

	// Use this app logger as the global logger (eventually remove all instances of global logging)
	mlog.InitGlobalLogger(app.Log)

	app.logListenerId = app.AddConfigListener(func(_, after *model.Config) {
		app.Log.ChangeLevels(utils.MloggerConfigFromLoggerConfig(&after.LogSettings))
	})

	app.EnableConfigWatch()

	app.LoadTimezones()

	if err := utils.InitTranslations(app.Config().LocalizationSettings); err != nil {
		return nil, errors.Wrapf(err, "unable to load Mattermost translation files")
	}

	app.configListenerId = app.AddConfigListener(func(_, _ *model.Config) {
		app.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CONFIG_CHANGED, "", "", "", nil)

		message.Add("config", app.ClientConfigWithComputed())
		app.Go(func() {
			app.Publish(message)
		})
	})
	app.licenseListenerId = app.AddLicenseListener(func() {
		app.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LICENSE_CHANGED, "", "", "", nil)
		message.Add("license", app.GetSanitizedClientLicense())
		app.Go(func() {
			app.Publish(message)
		})

	})

	if err := app.SetupInviteEmailRateLimiting(); err != nil {
		return nil, err
	}

	mlog.Info("Server is initializing...")

	app.initEnterprise()

	if app.newStore == nil {
		app.newStore = func() store.Store {
			return store.NewLayeredStore(sqlstore.NewSqlSupplier(app.Config().SqlSettings, app.Metrics), app.Metrics, app.Cluster)
		}
	}

	if htmlTemplateWatcher, err := utils.NewHTMLTemplateWatcher("templates"); err != nil {
		mlog.Error(fmt.Sprintf("Failed to parse server templates %v", err))
	} else {
		app.htmlTemplateWatcher = htmlTemplateWatcher
	}

	app.Srv.Store = app.newStore()

	app.AddConfigListener(func(_, current *model.Config) {
		if current.SqlSettings.EnablePublicChannelsMaterialization != nil && !*current.SqlSettings.EnablePublicChannelsMaterialization {
			app.Srv.Store.Channel().DisableExperimentalPublicChannelsMaterialization()
		} else {
			app.Srv.Store.Channel().EnableExperimentalPublicChannelsMaterialization()
		}
	})

	if err := app.ensureAsymmetricSigningKey(); err != nil {
		return nil, errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}

	if err := app.ensureInstallationDate(); err != nil {
		return nil, errors.Wrapf(err, "unable to ensure installation date")
	}

	app.EnsureDiagnosticId()
	app.regenerateClientConfig()

	app.initJobs()
	app.AddLicenseListener(func() {
		app.initJobs()
	})

	app.clusterLeaderListenerId = app.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if job schedulers should be running:", mlog.Bool("isLeader", app.IsLeader()))
		app.Jobs.Schedulers.HandleClusterLeaderChange(app.IsLeader())
	})

	subpath, err := utils.GetSubpathFromConfig(app.Config())
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse SiteURL subpath")
	}
	app.Srv.Router = app.Srv.RootRouter.PathPrefix(subpath).Subrouter()
	app.Srv.Router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}", app.ServePluginRequest)
	app.Srv.Router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}/{anything:.*}", app.ServePluginRequest)

	// If configured with a subpath, redirect 404s at the root back into the subpath.
	if subpath != "/" {
		app.Srv.RootRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = path.Join(subpath, r.URL.Path)
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		})
	}
	app.Srv.Router.NotFoundHandler = http.HandlerFunc(app.Handle404)

	app.Srv.WebSocketRouter = &WebSocketRouter{
		app:      app,
		handlers: make(map[string]webSocketHandler),
	}

	return app, nil
}

func (a *App) configOrLicenseListener() {
	a.regenerateClientConfig()
}

func (a *App) Shutdown() {
	appCount--

	mlog.Info("Stopping Server...")

	a.StopServer()
	a.HubStop()
	a.StopPushNotificationsHubWorkers()

	a.ShutDownPlugins()
	a.WaitForGoroutines()

	if a.Srv.Store != nil {
		a.Srv.Store.Close()
	}
	a.Srv = nil

	if a.htmlTemplateWatcher != nil {
		a.htmlTemplateWatcher.Close()
	}

	a.RemoveConfigListener(a.configListenerId)
	a.RemoveLicenseListener(a.licenseListenerId)
	a.RemoveConfigListener(a.logListenerId)
	a.RemoveClusterLeaderChangedListener(a.clusterLeaderListenerId)
	mlog.Info("Server stopped")

	a.DisableConfigWatch()

	a.HTTPService.Close()
}

var accountMigrationInterface func(*App) einterfaces.AccountMigrationInterface

func RegisterAccountMigrationInterface(f func(*App) einterfaces.AccountMigrationInterface) {
	accountMigrationInterface = f
}

var clusterInterface func(*App) einterfaces.ClusterInterface

func RegisterClusterInterface(f func(*App) einterfaces.ClusterInterface) {
	clusterInterface = f
}

var complianceInterface func(*App) einterfaces.ComplianceInterface

func RegisterComplianceInterface(f func(*App) einterfaces.ComplianceInterface) {
	complianceInterface = f
}

var dataRetentionInterface func(*App) einterfaces.DataRetentionInterface

func RegisterDataRetentionInterface(f func(*App) einterfaces.DataRetentionInterface) {
	dataRetentionInterface = f
}

var elasticsearchInterface func(*App) einterfaces.ElasticsearchInterface

func RegisterElasticsearchInterface(f func(*App) einterfaces.ElasticsearchInterface) {
	elasticsearchInterface = f
}

var jobsDataRetentionJobInterface func(*App) ejobs.DataRetentionJobInterface

func RegisterJobsDataRetentionJobInterface(f func(*App) ejobs.DataRetentionJobInterface) {
	jobsDataRetentionJobInterface = f
}

var jobsMessageExportJobInterface func(*App) ejobs.MessageExportJobInterface

func RegisterJobsMessageExportJobInterface(f func(*App) ejobs.MessageExportJobInterface) {
	jobsMessageExportJobInterface = f
}

var jobsElasticsearchAggregatorInterface func(*App) ejobs.ElasticsearchAggregatorInterface

func RegisterJobsElasticsearchAggregatorInterface(f func(*App) ejobs.ElasticsearchAggregatorInterface) {
	jobsElasticsearchAggregatorInterface = f
}

var jobsElasticsearchIndexerInterface func(*App) ejobs.ElasticsearchIndexerInterface

func RegisterJobsElasticsearchIndexerInterface(f func(*App) ejobs.ElasticsearchIndexerInterface) {
	jobsElasticsearchIndexerInterface = f
}

var jobsLdapSyncInterface func(*App) ejobs.LdapSyncInterface

func RegisterJobsLdapSyncInterface(f func(*App) ejobs.LdapSyncInterface) {
	jobsLdapSyncInterface = f
}

var jobsMigrationsInterface func(*App) tjobs.MigrationsJobInterface

func RegisterJobsMigrationsJobInterface(f func(*App) tjobs.MigrationsJobInterface) {
	jobsMigrationsInterface = f
}

var ldapInterface func(*App) einterfaces.LdapInterface

func RegisterLdapInterface(f func(*App) einterfaces.LdapInterface) {
	ldapInterface = f
}

var messageExportInterface func(*App) einterfaces.MessageExportInterface

func RegisterMessageExportInterface(f func(*App) einterfaces.MessageExportInterface) {
	messageExportInterface = f
}

var metricsInterface func(*App) einterfaces.MetricsInterface

func RegisterMetricsInterface(f func(*App) einterfaces.MetricsInterface) {
	metricsInterface = f
}

var mfaInterface func(*App) einterfaces.MfaInterface

func RegisterMfaInterface(f func(*App) einterfaces.MfaInterface) {
	mfaInterface = f
}

var samlInterface func(*App) einterfaces.SamlInterface

func RegisterSamlInterface(f func(*App) einterfaces.SamlInterface) {
	samlInterface = f
}

func (a *App) initEnterprise() {
	if accountMigrationInterface != nil {
		a.AccountMigration = accountMigrationInterface(a)
	}
	if clusterInterface != nil {
		a.Cluster = clusterInterface(a)
	}
	if complianceInterface != nil {
		a.Compliance = complianceInterface(a)
	}
	if elasticsearchInterface != nil {
		a.Elasticsearch = elasticsearchInterface(a)
	}
	if ldapInterface != nil {
		a.Ldap = ldapInterface(a)
		a.AddConfigListener(func(_, cfg *model.Config) {
			if err := utils.ValidateLdapFilter(cfg, a.Ldap); err != nil {
				panic(utils.T(err.Id))
			}
		})
	}
	if messageExportInterface != nil {
		a.MessageExport = messageExportInterface(a)
	}
	if metricsInterface != nil {
		a.Metrics = metricsInterface(a)
	}
	if mfaInterface != nil {
		a.Mfa = mfaInterface(a)
	}
	if samlInterface != nil {
		a.Saml = samlInterface(a)
		a.AddConfigListener(func(_, cfg *model.Config) {
			a.Saml.ConfigureSP()
		})
	}
	if dataRetentionInterface != nil {
		a.DataRetention = dataRetentionInterface(a)
	}
}

func (a *App) initJobs() {
	a.Jobs = jobs.NewJobServer(a, a.Srv.Store)
	if jobsDataRetentionJobInterface != nil {
		a.Jobs.DataRetentionJob = jobsDataRetentionJobInterface(a)
	}
	if jobsMessageExportJobInterface != nil {
		a.Jobs.MessageExportJob = jobsMessageExportJobInterface(a)
	}
	if jobsElasticsearchAggregatorInterface != nil {
		a.Jobs.ElasticsearchAggregator = jobsElasticsearchAggregatorInterface(a)
	}
	if jobsElasticsearchIndexerInterface != nil {
		a.Jobs.ElasticsearchIndexer = jobsElasticsearchIndexerInterface(a)
	}
	if jobsLdapSyncInterface != nil {
		a.Jobs.LdapSync = jobsLdapSyncInterface(a)
	}
	if jobsMigrationsInterface != nil {
		a.Jobs.Migrations = jobsMigrationsInterface(a)
	}
	a.Jobs.Workers = a.Jobs.InitWorkers()
	a.Jobs.Schedulers = a.Jobs.InitSchedulers()
}

func (a *App) DiagnosticId() string {
	return a.diagnosticId
}

func (a *App) SetDiagnosticId(id string) {
	a.diagnosticId = id
}

func (a *App) EnsureDiagnosticId() {
	if a.diagnosticId != "" {
		return
	}
	if result := <-a.Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)

		id := props[model.SYSTEM_DIAGNOSTIC_ID]
		if len(id) == 0 {
			id = model.NewId()
			systemId := &model.System{Name: model.SYSTEM_DIAGNOSTIC_ID, Value: id}
			<-a.Srv.Store.System().Save(systemId)
		}

		a.diagnosticId = id
	}
}

// Go creates a goroutine, but maintains a record of it to ensure that execution completes before
// the app is destroyed.
func (a *App) Go(f func()) {
	atomic.AddInt32(&a.goroutineCount, 1)

	go func() {
		f()

		atomic.AddInt32(&a.goroutineCount, -1)
		select {
		case a.goroutineExitSignal <- struct{}{}:
		default:
		}
	}()
}

// WaitForGoroutines blocks until all goroutines created by App.Go exit.
func (a *App) WaitForGoroutines() {
	for atomic.LoadInt32(&a.goroutineCount) != 0 {
		<-a.goroutineExitSignal
	}
}

func (a *App) HTMLTemplates() *template.Template {
	if a.htmlTemplateWatcher != nil {
		return a.htmlTemplateWatcher.Templates()
	}

	return nil
}

func (a *App) Handle404(w http.ResponseWriter, r *http.Request) {
	err := model.NewAppError("Handle404", "api.context.404.app_error", nil, "", http.StatusNotFound)

	mlog.Debug(fmt.Sprintf("%v: code=404 ip=%v", r.URL.Path, utils.GetIpAddress(r)))

	utils.RenderWebAppError(a.Config(), w, r, err, a.AsymmetricSigningKey())
}

// This function migrates the default built in roles from code/config to the database.
func (a *App) DoAdvancedPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if result := <-a.Srv.Store.System().GetByName(ADVANCED_PERMISSIONS_MIGRATION_KEY); result.Err == nil {
		return
	}

	mlog.Info("Migrating roles to database.")
	roles := model.MakeDefaultRoles()
	roles = utils.SetRolePermissionsFromConfig(roles, a.Config(), a.License() != nil)

	allSucceeded := true

	for _, role := range roles {
		if result := <-a.Srv.Store.Role().Save(role); result.Err != nil {
			// If this failed for reasons other than the role already existing, don't mark the migration as done.
			if result2 := <-a.Srv.Store.Role().GetByName(role.Name); result2.Err != nil {
				mlog.Critical("Failed to migrate role to database.")
				mlog.Critical(fmt.Sprint(result.Err))
				allSucceeded = false
			} else {
				// If the role already existed, check it is the same and update if not.
				fetchedRole := result.Data.(*model.Role)
				if !reflect.DeepEqual(fetchedRole.Permissions, role.Permissions) ||
					fetchedRole.DisplayName != role.DisplayName ||
					fetchedRole.Description != role.Description ||
					fetchedRole.SchemeManaged != role.SchemeManaged {
					role.Id = fetchedRole.Id
					if result := <-a.Srv.Store.Role().Save(role); result.Err != nil {
						// Role is not the same, but failed to update.
						mlog.Critical("Failed to migrate role to database.")
						mlog.Critical(fmt.Sprint(result.Err))
						allSucceeded = false
					}
				}
			}
		}
	}

	if !allSucceeded {
		return
	}

	config := a.Config()
	if *config.ServiceSettings.AllowEditPost == model.ALLOW_EDIT_POST_ALWAYS {
		*config.ServiceSettings.PostEditTimeLimit = -1
		if err := a.SaveConfig(config, true); err != nil {
			mlog.Error("Failed to update config in Advanced Permissions Phase 1 Migration.", mlog.String("error", err.Error()))
		}
	}

	system := model.System{
		Name:  ADVANCED_PERMISSIONS_MIGRATION_KEY,
		Value: "true",
	}

	if result := <-a.Srv.Store.System().Save(&system); result.Err != nil {
		mlog.Critical("Failed to mark advanced permissions migration as completed.")
		mlog.Critical(fmt.Sprint(result.Err))
	}
}

func (a *App) SetPhase2PermissionsMigrationStatus(isComplete bool) error {
	if !isComplete {
		res := <-a.Srv.Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2)
		if res.Err != nil {
			return res.Err
		}
	}
	a.phase2PermissionsMigrationComplete = isComplete
	return nil
}

func (a *App) DoEmojisPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if result := <-a.Srv.Store.System().GetByName(EMOJIS_PERMISSIONS_MIGRATION_KEY); result.Err == nil {
		return
	}

	var role *model.Role = nil
	var systemAdminRole *model.Role = nil
	var err *model.AppError = nil

	mlog.Info("Migrating emojis config to database.")
	switch *a.Config().ServiceSettings.RestrictCustomEmojiCreation {
	case model.RESTRICT_EMOJI_CREATION_ALL:
		role, err = a.GetRoleByName(model.SYSTEM_USER_ROLE_ID)
		if err != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
			mlog.Critical(err.Error())
			return
		}
	case model.RESTRICT_EMOJI_CREATION_ADMIN:
		role, err = a.GetRoleByName(model.TEAM_ADMIN_ROLE_ID)
		if err != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
			mlog.Critical(err.Error())
			return
		}
	case model.RESTRICT_EMOJI_CREATION_SYSTEM_ADMIN:
		role = nil
	default:
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
		mlog.Critical("Invalid restrict emoji creation setting")
		return
	}

	if role != nil {
		role.Permissions = append(role.Permissions, model.PERMISSION_MANAGE_EMOJIS.Id)
		if result := <-a.Srv.Store.Role().Save(role); result.Err != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
			mlog.Critical(result.Err.Error())
			return
		}
	}

	systemAdminRole, err = a.GetRoleByName(model.SYSTEM_ADMIN_ROLE_ID)
	if err != nil {
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
		mlog.Critical(err.Error())
		return
	}

	systemAdminRole.Permissions = append(systemAdminRole.Permissions, model.PERMISSION_MANAGE_EMOJIS.Id)
	systemAdminRole.Permissions = append(systemAdminRole.Permissions, model.PERMISSION_MANAGE_OTHERS_EMOJIS.Id)
	if result := <-a.Srv.Store.Role().Save(systemAdminRole); result.Err != nil {
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
		mlog.Critical(result.Err.Error())
		return
	}

	system := model.System{
		Name:  EMOJIS_PERMISSIONS_MIGRATION_KEY,
		Value: "true",
	}

	if result := <-a.Srv.Store.System().Save(&system); result.Err != nil {
		mlog.Critical("Failed to mark emojis permissions migration as completed.")
		mlog.Critical(fmt.Sprint(result.Err))
	}
}

func (a *App) StartElasticsearch() {
	a.Go(func() {
		if err := a.Elasticsearch.Start(); err != nil {
			mlog.Error(err.Error())
		}
	})

	a.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if !*oldConfig.ElasticsearchSettings.EnableIndexing && *newConfig.ElasticsearchSettings.EnableIndexing {
			a.Go(func() {
				if err := a.Elasticsearch.Start(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else if *oldConfig.ElasticsearchSettings.EnableIndexing && !*newConfig.ElasticsearchSettings.EnableIndexing {
			a.Go(func() {
				if err := a.Elasticsearch.Stop(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else if *oldConfig.ElasticsearchSettings.Password != *newConfig.ElasticsearchSettings.Password || *oldConfig.ElasticsearchSettings.Username != *newConfig.ElasticsearchSettings.Username || *oldConfig.ElasticsearchSettings.ConnectionUrl != *newConfig.ElasticsearchSettings.ConnectionUrl || *oldConfig.ElasticsearchSettings.Sniff != *newConfig.ElasticsearchSettings.Sniff {
			a.Go(func() {
				if *oldConfig.ElasticsearchSettings.EnableIndexing {
					if err := a.Elasticsearch.Stop(); err != nil {
						mlog.Error(err.Error())
					}
					if err := a.Elasticsearch.Start(); err != nil {
						mlog.Error(err.Error())
					}
				}
			})
		}
	})

	a.AddLicenseListener(func() {
		if a.License() != nil {
			a.Go(func() {
				if err := a.Elasticsearch.Start(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else {
			a.Go(func() {
				if err := a.Elasticsearch.Stop(); err != nil {
					mlog.Error(err.Error())
				}
			})
		}
	})
}

func (a *App) getSystemInstallDate() (int64, *model.AppError) {
	result := <-a.Srv.Store.System().GetByName(model.SYSTEM_INSTALLATION_DATE_KEY)
	if result.Err != nil {
		return 0, result.Err
	}
	systemData := result.Data.(*model.System)
	value, err := strconv.ParseInt(systemData.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("getSystemInstallDate", "app.system_install_date.parse_int.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return value, nil
}
