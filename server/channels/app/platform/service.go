// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"crypto/ecdsa"
	"errors"
	"fmt"
	"hash/maphash"
	"net/http"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/featureflag"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/localcachelayer"
	"github.com/mattermost/mattermost/server/v8/channels/store/retrylayer"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchlayer"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/channels/store/timerlayer"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine/bleveengine"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

// PlatformService is the service for the platform related tasks. It is
// responsible for non-entity related functionalities that are required
// by a product such as database access, configuration access, licensing etc.
type PlatformService struct {
	sqlStore     *sqlstore.SqlStore
	Store        store.Store
	newStore     func() (store.Store, error)
	storeOptions []sqlstore.Option

	WebSocketRouter *WebSocketRouter

	configStore *config.Store

	filestore       filestore.FileBackend
	exportFilestore filestore.FileBackend

	cacheProvider cache.Provider
	statusCache   cache.Cache
	sessionCache  cache.Cache

	asymmetricSigningKey atomic.Pointer[ecdsa.PrivateKey]
	clientConfig         atomic.Value
	clientConfigHash     atomic.Value
	limitedClientConfig  atomic.Value

	isFirstUserAccountLock sync.Mutex
	isFirstUserAccount     atomic.Bool

	logger              *mlog.Logger
	notificationsLogger *mlog.Logger

	startMetrics bool
	metrics      *platformMetrics
	metricsIFace einterfaces.MetricsInterface

	featureFlagSynchronizerMutex sync.Mutex
	featureFlagSynchronizer      *featureflag.Synchronizer
	featureFlagStop              chan struct{}
	featureFlagStopped           chan struct{}

	licenseValue       atomic.Pointer[model.License]
	clientLicenseValue atomic.Value
	licenseListeners   map[string]func(*model.License, *model.License)
	licenseManager     einterfaces.LicenseInterface

	telemetryId       string
	configListenerId  string
	licenseListenerId string

	clusterLeaderListeners sync.Map
	clusterIFace           einterfaces.ClusterInterface
	Busy                   *Busy

	SearchEngine            *searchengine.Broker
	searchConfigListenerId  string
	searchLicenseListenerId string

	ldapDiagnostic einterfaces.LdapDiagnosticInterface

	Jobs *jobs.JobServer

	hubs     []*Hub
	hashSeed maphash.Seed

	goroutineCount      int32
	goroutineExitSignal chan struct{}
	goroutineBuffered   chan struct{}

	additionalClusterHandlers map[model.ClusterEvent]einterfaces.ClusterMessageHandler

	shareChannelServiceMux sync.RWMutex
	sharedChannelService   SharedChannelServiceIFace

	pluginEnv HookRunner

	// This is a test mode setting used to enable Redis
	// without a license.
	forceEnableRedis bool

	pdpService einterfaces.PolicyDecisionPointInterface
}

type HookRunner interface {
	RunMultiHook(hookRunnerFunc func(hooks plugin.Hooks, _ *model.Manifest) bool, hookId int)
	GetPluginsEnvironment() *plugin.Environment
}

// New creates a new PlatformService.
func New(sc ServiceConfig, options ...Option) (*PlatformService, error) {
	// Step 0: Create the PlatformService.
	// ConfigStore is and should be handled on a upper level.
	ps := &PlatformService{
		Store:               sc.Store,
		clusterIFace:        sc.Cluster,
		hashSeed:            maphash.MakeSeed(),
		goroutineExitSignal: make(chan struct{}, 1),
		goroutineBuffered:   make(chan struct{}, runtime.NumCPU()),
		WebSocketRouter: &WebSocketRouter{
			handlers: make(map[string]webSocketHandler),
		},
		licenseListeners:          map[string]func(*model.License, *model.License){},
		additionalClusterHandlers: map[model.ClusterEvent]einterfaces.ClusterMessageHandler{},
	}

	// Assume the first user account has not been created yet. A call to the DB will later check if this is really the case.
	ps.isFirstUserAccount.Store(true)

	// Apply options, some of the options overrides the default config actually.
	for _, option := range options {
		if err2 := option(ps); err2 != nil {
			return nil, fmt.Errorf("failed to apply option: %w", err2)
		}
	}

	// the config store is not set, we need to create a new one
	if ps.configStore == nil {
		innerStore, err := config.NewFileStore("config.json", true)
		if err != nil {
			return nil, fmt.Errorf("failed to load config from file: %w", err)
		}

		configStore, err := config.NewStoreFromBacking(innerStore, nil, false)
		if err != nil {
			return nil, fmt.Errorf("failed to load config from file: %w", err)
		}

		ps.configStore = configStore
	}

	// Step 1: Cache provider.
	cacheConfig := ps.configStore.Get().CacheSettings
	var err error
	if *cacheConfig.CacheType == model.CacheTypeLRU {
		ps.cacheProvider = cache.NewProvider()
	} else if *cacheConfig.CacheType == model.CacheTypeRedis {
		ps.cacheProvider, err = cache.NewRedisProvider(
			&cache.RedisOptions{
				RedisAddr:        *cacheConfig.RedisAddress,
				RedisPassword:    *cacheConfig.RedisPassword,
				RedisDB:          *cacheConfig.RedisDB,
				RedisCachePrefix: *cacheConfig.RedisCachePrefix,
				DisableCache:     *cacheConfig.DisableClientCache,
			},
		)
	}
	if err != nil {
		return nil, fmt.Errorf("unable to create cache provider: %w", err)
	}

	// The value of res is used later, after the logger is initialized.
	// There's a certain order of steps we need to follow in the server startup phase.
	res, err := ps.cacheProvider.Connect()
	if err != nil {
		return nil, fmt.Errorf("unable to connect to cache provider: %w", err)
	}

	// Step 2: Start logging.
	if err2 := ps.initLogging(); err2 != nil {
		return nil, fmt.Errorf("failed to initialize logging: %w", err2)
	}
	ps.Log().Info("Successfully connected to cache backend", mlog.String("backend", *cacheConfig.CacheType), mlog.String("result", res))

	// This is called after initLogging() to avoid a race condition.
	ps.Log().Info("Server is initializing...", mlog.String("go_version", runtime.Version()))

	// Step 3: Search Engine
	searchEngine := searchengine.NewBroker(ps.Config())
	bleveEngine := bleveengine.NewBleveEngine(ps.Config())
	if err := bleveEngine.Start(); err != nil {
		return nil, err
	}
	searchEngine.RegisterBleveEngine(bleveEngine)
	ps.SearchEngine = searchEngine

	// Step 4: Init Enterprise
	// Depends on step 3 (s.SearchEngine must be non-nil)
	ps.initEnterprise()

	// Step 5: Init Metrics
	if metricsInterfaceFn != nil && ps.metricsIFace == nil { // if the metrics interface is set by options, do not override it
		ps.metricsIFace = metricsInterfaceFn(ps, *ps.configStore.Get().SqlSettings.DriverName, *ps.configStore.Get().SqlSettings.DataSource)
	}

	ps.cacheProvider.SetMetrics(ps.metricsIFace)

	// Step 6: Store.
	// Depends on Step 0 (config), 1 (cacheProvider), 3 (search engine), 5 (metrics) and cluster.
	if ps.newStore == nil {
		ps.newStore = func() (store.Store, error) {
			// The layer cake is as follows: (From bottom to top)
			// SQL layer
			// |
			// Retry layer
			// |
			// Search layer
			// |
			// Timer layer
			// |
			// Cache layer
			ps.sqlStore, err = sqlstore.New(ps.Config().SqlSettings, ps.Log(), ps.metricsIFace, ps.storeOptions...)
			if err != nil {
				return nil, err
			}

			searchStore := searchlayer.NewSearchLayer(
				retrylayer.New(ps.sqlStore),
				ps.SearchEngine,
				ps.Config(),
			)

			ps.AddConfigListener(func(prevCfg, cfg *model.Config) {
				searchStore.UpdateConfig(cfg)
			})

			lcl, err2 := localcachelayer.NewLocalCacheLayer(
				timerlayer.New(searchStore, ps.metricsIFace),
				ps.metricsIFace,
				ps.clusterIFace,
				ps.cacheProvider,
				ps.Log(),
			)
			if err2 != nil {
				return nil, fmt.Errorf("cannot create local cache layer: %w", err2)
			}

			license := ps.License()
			ps.sqlStore.UpdateLicense(license)
			ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
				ps.sqlStore.UpdateLicense(newLicense)
			})

			return lcl, nil
		}
	}

	ps.Store, err = ps.newStore()
	if err != nil {
		return nil, fmt.Errorf("cannot create store: %w", err)
	}

	// Step 7: initialize status and session cache.
	// We need to do this because ps.LoadLicense() called in step 8, could
	// end up calling InvalidateAllCaches, so the status and session caches
	// need to be initialized before that.

	// Note: we hardcode the session and status cache to LRU because they lead
	// to a lot of SCAN calls in case of Redis. We could potentially have a
	// reverse mapping to avoid the scan, but this needs more complicated code.
	// Leaving this for now.
	ps.statusCache, err = cache.NewProvider().NewCache(&cache.CacheOptions{
		Name:           "Status",
		Size:           model.StatusCacheSize,
		Striped:        true,
		StripedBuckets: max(runtime.NumCPU()-1, 1),
		DefaultExpiry:  30 * time.Minute,
	})
	if err != nil {
		return nil, fmt.Errorf("unable to create status cache: %w", err)
	}

	ps.sessionCache, err = cache.NewProvider().NewCache(&cache.CacheOptions{
		Name:           "Session",
		Size:           model.SessionCacheSize,
		Striped:        true,
		StripedBuckets: max(runtime.NumCPU()-1, 1),
	})
	if err != nil {
		return nil, fmt.Errorf("could not create session cache: %w", err)
	}

	// Step 8: Init License
	if model.BuildEnterpriseReady == "true" {
		ps.LoadLicense()
	}
	license := ps.License()

	// This is a hack because ideally we wouldn't even have started the Redis client
	// if the license didn't have clustering. But there's an intricate deadlock
	// where license cannot be loaded before store, and store cannot be loaded before
	// cache. So loading license before loading cache is an uphill battle.
	if (license == nil || !*license.Features.Cluster) && *cacheConfig.CacheType == model.CacheTypeRedis && !ps.forceEnableRedis {
		return nil, fmt.Errorf("Redis cannot be used in an instance without a license or a license without clustering")
	}

	// Step 9: Initialize filestore
	if ps.filestore == nil {
		insecure := ps.Config().ServiceSettings.EnableInsecureOutgoingConnections
		backend, err2 := filestore.NewFileBackend(filestore.NewFileBackendSettingsFromConfig(&ps.Config().FileSettings, license != nil && *license.Features.Compliance, insecure != nil && *insecure))
		if err2 != nil {
			return nil, fmt.Errorf("failed to initialize filebackend: %w", err2)
		}

		ps.filestore = backend
	}

	if ps.exportFilestore == nil {
		ps.exportFilestore = ps.filestore
		if *ps.Config().FileSettings.DedicatedExportStore {
			mlog.Info("Setting up dedicated export filestore", mlog.String("driver_name", *ps.Config().FileSettings.ExportDriverName))
			backend, errFileBack := filestore.NewExportFileBackend(filestore.NewExportFileBackendSettingsFromConfig(&ps.Config().FileSettings, license != nil && *license.Features.Compliance, false))
			if errFileBack != nil {
				return nil, fmt.Errorf("failed to initialize export filebackend: %w", errFileBack)
			}

			ps.exportFilestore = backend
		}
	}

	// Step 10: Init Metrics Server depends on step 6 (store) and 8 (license)
	if ps.startMetrics {
		if mErr := ps.resetMetrics(); mErr != nil {
			return nil, mErr
		}

		ps.configStore.AddListener(func(oldCfg, newCfg *model.Config) {
			if *oldCfg.MetricsSettings.Enable != *newCfg.MetricsSettings.Enable || *oldCfg.MetricsSettings.ListenAddress != *newCfg.MetricsSettings.ListenAddress {
				if mErr := ps.resetMetrics(); mErr != nil {
					mlog.Warn("Failed to reset metrics", mlog.Err(mErr))
				}
			}
		})
	}

	// Step 11: Init AsymmetricSigningKey depends on step 6 (store)
	if err = ps.EnsureAsymmetricSigningKey(); err != nil {
		return nil, fmt.Errorf("unable to ensure asymmetric signing key: %w", err)
	}

	ps.Busy = NewBusy(ps.clusterIFace)

	// Enable developer settings and mmctl local mode if this is a "dev" build
	if model.BuildNumber == "dev" {
		ps.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableDeveloper = true
			*cfg.ServiceSettings.EnableLocalMode = true
		})
	}

	ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		wasLicensed := (oldLicense != nil && *oldLicense.Features.Metrics) || (model.BuildNumber == "dev")
		isLicensed := (newLicense != nil && *newLicense.Features.Metrics) || (model.BuildNumber == "dev")

		if wasLicensed == isLicensed || !ps.startMetrics {
			return
		}

		if err := ps.RestartMetrics(); err != nil {
			ps.logger.Error("Failed to reset metrics server", mlog.Err(err))
		}
	})

	if err := ps.SearchEngine.UpdateConfig(ps.Config()); err != nil {
		ps.logger.Error("Failed to update search engine config", mlog.Err(err))
	}

	searchConfigListenerId, searchLicenseListenerId := ps.StartSearchEngine()
	ps.searchConfigListenerId = searchConfigListenerId
	ps.searchLicenseListenerId = searchLicenseListenerId

	return ps, nil
}

func (ps *PlatformService) Start(broadcastHooks map[string]BroadcastHook) error {
	ps.hubStart(broadcastHooks)

	ps.configListenerId = ps.AddConfigListener(func(_, _ *model.Config) {
		ps.regenerateClientConfig()

		message := model.NewWebSocketEvent(model.WebsocketEventConfigChanged, "", "", "", nil, "")

		message.Add("config", ps.ClientConfigWithComputed())
		ps.Go(func() {
			ps.Publish(message)
		})

		if err := ps.ReconfigureLogger(); err != nil {
			mlog.Error("Error re-configuring logging after config change", mlog.Err(err))
			return
		}
	})

	ps.licenseListenerId = ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		ps.regenerateClientConfig()

		message := model.NewWebSocketEvent(model.WebsocketEventLicenseChanged, "", "", "", nil, "")
		message.Add("license", ps.GetSanitizedClientLicense())
		ps.Publish(message)
	})
	return nil
}

func (ps *PlatformService) ShutdownMetrics() error {
	if ps.metrics != nil {
		return ps.metrics.stopMetricsServer()
	}

	return nil
}

func (ps *PlatformService) ShutdownConfig() error {
	ps.RemoveConfigListener(ps.configListenerId)

	if ps.configStore != nil {
		err := ps.configStore.Close()
		if err != nil {
			return fmt.Errorf("failed to close config store: %w", err)
		}
	}

	return nil
}

func (ps *PlatformService) SetTelemetryId(id string) {
	ps.telemetryId = id

	ps.PostTelemetryIdHook()
}

// PostTelemetryIdHook triggers necessary events to propagate telemtery ID
func (ps *PlatformService) PostTelemetryIdHook() {
	ps.regenerateClientConfig()
}

func (ps *PlatformService) SetLogger(logger *mlog.Logger) {
	ps.logger = logger
}

func (ps *PlatformService) initEnterprise() {
	if clusterInterface != nil && ps.clusterIFace == nil {
		ps.clusterIFace = clusterInterface(ps)
	}

	if elasticsearchInterface != nil {
		ps.SearchEngine.RegisterElasticsearchEngine(elasticsearchInterface(ps))
	}

	if ldapDiagnosticInterface != nil {
		ps.ldapDiagnostic = ldapDiagnosticInterface(ps)
	}

	if licenseInterface != nil {
		ps.licenseManager = licenseInterface(ps)
	}

	if accessControlServiceInterface != nil {
		ps.pdpService = accessControlServiceInterface(ps)
	}
}

func (ps *PlatformService) TotalWebsocketConnections() int {
	// This method is only called after the hub is initialized.
	// Therefore, no mutex is needed to protect s.hubs.
	count := int64(0)
	for _, hub := range ps.hubs {
		count = count + atomic.LoadInt64(&hub.connectionCount)
	}

	return int(count)
}

func (ps *PlatformService) Shutdown() error {
	ps.HubStop()

	ps.RemoveLicenseListener(ps.licenseListenerId)

	// we need to wait the goroutines to finish before closing the store
	// and this needs to be called after hub stop because hub generates goroutines
	// when it is active. If we wait first we have no mechanism to prevent adding
	// more go routines hence they still going to be invoked.
	ps.waitForGoroutines()

	if ps.Store != nil {
		ps.Store.Close()
	}

	if ps.cacheProvider != nil {
		if err := ps.cacheProvider.Close(); err != nil {
			return fmt.Errorf("unable to cleanly shutdown cache: %w", err)
		}
	}

	return nil
}

func (ps *PlatformService) CacheProvider() cache.Provider {
	return ps.cacheProvider
}

// SetSqlStore is used for plugin testing
func (ps *PlatformService) SetSqlStore(s *sqlstore.SqlStore) {
	ps.sqlStore = s
}

func (ps *PlatformService) SetSharedChannelService(s SharedChannelServiceIFace) {
	ps.shareChannelServiceMux.Lock()
	defer ps.shareChannelServiceMux.Unlock()
	ps.sharedChannelService = s
}

func (ps *PlatformService) GetSharedChannelService() SharedChannelServiceIFace {
	ps.shareChannelServiceMux.RLock()
	defer ps.shareChannelServiceMux.RUnlock()
	return ps.sharedChannelService
}

func (ps *PlatformService) SetPluginsEnvironment(runner HookRunner) {
	ps.pluginEnv = runner
}

// GetPluginStatuses meant to be used by cluster implementation
func (ps *PlatformService) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	if ps.pluginEnv == nil || ps.pluginEnv.GetPluginsEnvironment() == nil {
		return nil, model.NewAppError("GetPluginStatuses", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	pluginStatuses, err := ps.pluginEnv.GetPluginsEnvironment().Statuses()
	if err != nil {
		return nil, model.NewAppError("GetPluginStatuses", "app.plugin.get_statuses.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Add our cluster ID
	for _, status := range pluginStatuses {
		if ps.Cluster() != nil {
			status.ClusterId = ps.Cluster().GetClusterId()
		} else {
			status.ClusterId = ""
		}
	}

	return pluginStatuses, nil
}

func (ps *PlatformService) getPluginManifests() ([]*model.Manifest, error) {
	if ps.pluginEnv == nil {
		return nil, errors.New("plugin environment not initialized")
	}

	pluginsEnvironment := ps.pluginEnv.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("getPluginManifests", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return nil, fmt.Errorf("failed to get list of available plugins: %w", err)
	}

	manifests := make([]*model.Manifest, len(plugins))
	for i := range plugins {
		manifests[i] = plugins[i].Manifest
	}

	return manifests, nil
}

func (ps *PlatformService) FileBackend() filestore.FileBackend {
	return ps.filestore
}

func (ps *PlatformService) ExportFileBackend() filestore.FileBackend {
	return ps.exportFilestore
}

func (ps *PlatformService) LdapDiagnostic() einterfaces.LdapDiagnosticInterface {
	return ps.ldapDiagnostic
}

// DatabaseTypeAndSchemaVersion returns the Database type (postgres or mysql) and current version of the schema
func (ps *PlatformService) DatabaseTypeAndSchemaVersion() (string, string, error) {
	schemaVersion, err := ps.Store.GetDBSchemaVersion()
	if err != nil {
		return "", "", err
	}

	return model.SafeDereference(ps.Config().SqlSettings.DriverName), strconv.Itoa(schemaVersion), nil
}
