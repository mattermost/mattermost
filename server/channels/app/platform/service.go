// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"fmt"
	"hash/maphash"
	"net/http"
	"runtime"
	"sync"
	"sync/atomic"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/plugin"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/featureflag"
	"github.com/mattermost/mattermost-server/server/v8/channels/jobs"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/localcachelayer"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/retrylayer"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/searchlayer"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/timerlayer"
	"github.com/mattermost/mattermost-server/server/v8/config"
	"github.com/mattermost/mattermost-server/server/v8/einterfaces"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/cache"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/searchengine"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/searchengine/bleveengine"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/filestore"
)

// PlatformService is the service for the platform related tasks. It is
// responsible for non-entity related functionalities that are required
// by a product such as database access, configuration access, licensing etc.
type PlatformService struct {
	sqlStore *sqlstore.SqlStore
	Store    store.Store
	newStore func() (store.Store, error)

	WebSocketRouter *WebSocketRouter

	configStore *config.Store

	filestore filestore.FileBackend

	cacheProvider cache.Provider
	statusCache   cache.Cache
	sessionCache  cache.Cache
	sessionPool   sync.Pool

	asymmetricSigningKey atomic.Value
	clientConfig         atomic.Value
	clientConfigHash     atomic.Value
	limitedClientConfig  atomic.Value
	isFirstUserAccount   atomic.Bool

	logger              *mlog.Logger
	notificationsLogger *mlog.Logger

	startMetrics bool
	metrics      *platformMetrics
	metricsIFace einterfaces.MetricsInterface

	featureFlagSynchronizerMutex sync.Mutex
	featureFlagSynchronizer      *featureflag.Synchronizer
	featureFlagStop              chan struct{}
	featureFlagStopped           chan struct{}

	licenseValue       atomic.Value
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

	Jobs *jobs.JobServer

	hubs     []*Hub
	hashSeed maphash.Seed

	goroutineCount      int32
	goroutineExitSignal chan struct{}
	goroutineBuffered   chan struct{}

	additionalClusterHandlers map[model.ClusterEvent]einterfaces.ClusterMessageHandler
	sharedChannelService      SharedChannelServiceIFace

	pluginEnv HookRunner
}

type HookRunner interface {
	RunMultiHook(hookRunnerFunc func(hooks plugin.Hooks) bool, hookId int)
	GetPluginsEnvironment() *plugin.Environment
}

// New creates a new PlatformService.
func New(sc ServiceConfig, options ...Option) (*PlatformService, error) {
	// Step 0: Create the PlatformService.
	// ConfigStore is and should be handled on a upper level.
	ps := &PlatformService{
		Store:               sc.Store,
		configStore:         sc.ConfigStore,
		clusterIFace:        sc.Cluster,
		hashSeed:            maphash.MakeSeed(),
		goroutineExitSignal: make(chan struct{}, 1),
		goroutineBuffered:   make(chan struct{}, runtime.NumCPU()),
		WebSocketRouter: &WebSocketRouter{
			handlers: make(map[string]webSocketHandler),
		},
		sessionPool: sync.Pool{
			New: func() any {
				return &model.Session{}
			},
		},
		licenseListeners:          map[string]func(*model.License, *model.License){},
		additionalClusterHandlers: map[model.ClusterEvent]einterfaces.ClusterMessageHandler{},
	}

	// Assume the first user account has not been created yet. A call to the DB will later check if this is really the case.
	ps.isFirstUserAccount.Store(true)

	// Step 1: Cache provider.
	// At the moment we only have this implementation
	// in the future the cache provider will be built based on the loaded config
	ps.cacheProvider = cache.NewProvider()
	if err2 := ps.cacheProvider.Connect(); err2 != nil {
		return nil, fmt.Errorf("unable to connect to cache provider: %w", err2)
	}

	// Apply options, some of the options overrides the default config actually.
	for _, option := range options {
		if err := option(ps); err != nil {
			return nil, fmt.Errorf("failed to apply option: %w", err)
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

	// Step 2: Start logging.
	if err := ps.initLogging(); err != nil {
		return nil, fmt.Errorf("failed to initialize logging: %w", err)
	}

	// This is called after initLogging() to avoid a race condition.
	mlog.Info("Server is initializing...", mlog.String("go_version", runtime.Version()))

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

	// Step 6: Store.
	// Depends on Step 0 (config), 1 (cacheProvider), 3 (search engine), 5 (metrics) and cluster.
	if ps.newStore == nil {
		ps.newStore = func() (store.Store, error) {
			ps.sqlStore = sqlstore.New(ps.Config().SqlSettings, ps.metricsIFace)

			lcl, err2 := localcachelayer.NewLocalCacheLayer(
				retrylayer.New(ps.sqlStore),
				ps.metricsIFace,
				ps.clusterIFace,
				ps.cacheProvider,
			)
			if err2 != nil {
				return nil, fmt.Errorf("cannot create local cache layer: %w", err2)
			}

			searchStore := searchlayer.NewSearchLayer(
				lcl,
				ps.SearchEngine,
				ps.Config(),
			)

			ps.AddConfigListener(func(prevCfg, cfg *model.Config) {
				searchStore.UpdateConfig(cfg)
			})

			license := ps.License()
			ps.sqlStore.UpdateLicense(license)
			ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
				ps.sqlStore.UpdateLicense(newLicense)
			})

			return timerlayer.New(
				searchStore,
				ps.metricsIFace,
			), nil
		}
	}

	license := ps.License()
	// Step 3: Initialize filestore
	if ps.filestore == nil {
		insecure := ps.Config().ServiceSettings.EnableInsecureOutgoingConnections
		backend, err2 := filestore.NewFileBackend(filestore.NewFileBackendSettingsFromConfig(&ps.Config().FileSettings, license != nil && *license.Features.Compliance, insecure != nil && *insecure))
		if err2 != nil {
			return nil, fmt.Errorf("failed to initialize filebackend: %w", err2)
		}

		ps.filestore = backend
	}

	var err error
	ps.Store, err = ps.newStore()
	if err != nil {
		return nil, fmt.Errorf("cannot create store: %w", err)
	}

	// Needed before loading license
	ps.statusCache, err = ps.cacheProvider.NewCache(&cache.CacheOptions{
		Size:           model.StatusCacheSize,
		Striped:        true,
		StripedBuckets: maxInt(runtime.NumCPU()-1, 1),
	})
	if err != nil {
		return nil, fmt.Errorf("unable to create status cache: %w", err)
	}

	ps.sessionCache, err = ps.cacheProvider.NewCache(&cache.CacheOptions{
		Size:           model.SessionCacheSize,
		Striped:        true,
		StripedBuckets: maxInt(runtime.NumCPU()-1, 1),
	})
	if err != nil {
		return nil, fmt.Errorf("could not create session cache: %w", err)
	}

	// Step 7: Init License
	if model.BuildEnterpriseReady == "true" {
		ps.LoadLicense()
	}

	// Step 8: Init Metrics Server depends on step 6 (store) and 7 (license)
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

	// Step 9: Init AsymmetricSigningKey depends on step 6 (store)
	if err = ps.EnsureAsymmetricSigningKey(); err != nil {
		return nil, fmt.Errorf("unable to ensure asymmetric signing key: %w", err)
	}

	ps.Busy = NewBusy(ps.clusterIFace)

	// Enable developer settings if this is a "dev" build
	if model.BuildNumber == "dev" {
		ps.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })
	}

	ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		if (oldLicense == nil && newLicense == nil) || !ps.startMetrics {
			return
		}

		if oldLicense != nil && newLicense != nil && *oldLicense.Features.Metrics == *newLicense.Features.Metrics {
			return
		}

		if err := ps.RestartMetrics(); err != nil {
			ps.logger.Error("Failed to reset metrics server", mlog.Err(err))
		}
	})

	ps.SearchEngine.UpdateConfig(ps.Config())
	searchConfigListenerId, searchLicenseListenerId := ps.StartSearchEngine()
	ps.searchConfigListenerId = searchConfigListenerId
	ps.searchLicenseListenerId = searchLicenseListenerId

	return ps, nil
}

func (ps *PlatformService) Start() error {
	ps.hubStart()

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
		ps.Go(func() {
			ps.Publish(message)
		})

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

	if licenseInterface != nil {
		ps.licenseManager = licenseInterface(ps)
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

func (ps *PlatformService) StatusCache() cache.Cache {
	return ps.statusCache
}

// SetSqlStore is used for plugin testing
func (ps *PlatformService) SetSqlStore(s *sqlstore.SqlStore) {
	ps.sqlStore = s
}

func (ps *PlatformService) SetSharedChannelService(s SharedChannelServiceIFace) {
	ps.sharedChannelService = s
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

func (ps *PlatformService) FileBackend() filestore.FileBackend {
	return ps.filestore
}
