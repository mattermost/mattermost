// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"fmt"
	"hash/maphash"
	"runtime"
	"sync"
	"sync/atomic"

	"github.com/mattermost/mattermost-server/v6/app/featureflag"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/cache"
	"github.com/mattermost/mattermost-server/v6/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/services/searchengine/bleveengine"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v6/store/retrylayer"
	"github.com/mattermost/mattermost-server/v6/store/searchlayer"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
	"github.com/mattermost/mattermost-server/v6/store/timerlayer"
)

// PlatformService is the service for the platform related tasks. It is
// responsible for non-entity related functionalities that are required
// by a product such as database access, configuration access, licensing etc.
type PlatformService struct {
	sqlStore *sqlstore.SqlStore
	Store    store.Store
	newStore func() (store.Store, error)

	WebSocketRouter *WebSocketRouter

	serviceConfig ServiceConfig
	configStore   *config.Store
	store         store.Store

	cacheProvider cache.Provider
	statusCache   cache.Cache
	sessionCache  cache.Cache
	sessionPool   sync.Pool

	asymmetricSigningKey atomic.Value
	clientConfig         atomic.Value
	clientConfigHash     atomic.Value
	limitedClientConfig  atomic.Value

	logger              *mlog.Logger
	notificationsLogger *mlog.Logger

	metrics *platformMetrics

	featureFlagSynchronizerMutex sync.Mutex
	featureFlagSynchronizer      *featureflag.Synchronizer
	featureFlagStop              chan struct{}
	featureFlagStopped           chan struct{}

	licenseValue       atomic.Value
	clientLicenseValue atomic.Value
	licenseListeners   map[string]func(*model.License, *model.License)
	LicenseManager     einterfaces.LicenseInterface

	telemetryId string

	clusterLeaderListeners sync.Map
	clusterIFace           einterfaces.ClusterInterface
	Busy                   *Busy

	SearchEngine *searchengine.Broker

	Jobs *jobs.JobServer

	hubs     []*Hub
	hashSeed maphash.Seed

	goroutineCount      int32
	goroutineExitSignal chan struct{}
}

// New creates a new PlatformService.
func New(sc ServiceConfig) (*PlatformService, error) {
	if err := sc.validate(); err != nil {
		return nil, err
	}

	ps := &PlatformService{
		serviceConfig:       sc,
		store:               sc.Store,
		configStore:         sc.ConfigStore,
		clusterIFace:        sc.Cluster,
		hashSeed:            maphash.MakeSeed(),
		goroutineExitSignal: make(chan struct{}, 1),
		WebSocketRouter: &WebSocketRouter{
			handlers: make(map[string]webSocketHandler),
		},
		sessionPool: sync.Pool{
			New: func() any {
				return &model.Session{}
			},
		},
		licenseListeners: map[string]func(*model.License, *model.License){},
	}

	if err := ps.initLogging(); err != nil {
		return nil, fmt.Errorf("failed to initialize logging: %w", err)
	}

	if err := ps.resetMetrics(sc.Metrics, ps.configStore.Get); err != nil {
		return nil, err
	}

	// Step 3: Search Engine
	// Depends on Step 1 (config).
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

	// Step 5: Cache provider.
	// At the moment we only have this implementation
	// in the future the cache provider will be built based on the loaded config
	ps.cacheProvider = cache.NewProvider()
	if err2 := ps.cacheProvider.Connect(); err2 != nil {
		return nil, fmt.Errorf("unable to connect to cache provider: %w", err2)
	}

	if ps.newStore == nil {
		ps.newStore = func() (store.Store, error) {
			ps.sqlStore = sqlstore.New(ps.Config().SqlSettings, ps.Metrics())

			lcl, err2 := localcachelayer.NewLocalCacheLayer(
				retrylayer.New(ps.sqlStore),
				ps.Metrics(),
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

			ps.sqlStore.UpdateLicense(ps.License())
			ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
				ps.sqlStore.UpdateLicense(newLicense)
			})

			return timerlayer.New(
				searchStore,
				ps.Metrics(),
			), nil
		}
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

	// TODO: platform: got back from user service
	ps.sessionCache, err = ps.cacheProvider.NewCache(&cache.CacheOptions{
		Size:           model.SessionCacheSize,
		Striped:        true,
		StripedBuckets: maxInt(runtime.NumCPU()-1, 1),
	})
	if err != nil {
		return nil, fmt.Errorf("could not create session cache: %w", err)
	}

	if model.BuildEnterpriseReady == "true" {
		// Dependent on user service
		ps.LoadLicense()
	}

	// TODO: platform: remove nil check after store migration completed
	if ps.store != nil {
		if err := ps.ensureAsymmetricSigningKey(); err != nil {
			return nil, fmt.Errorf("unable to ensure asymmetric signing key: %w", err)
		}
	}

	ps.Busy = NewBusy(ps.clusterIFace)

	return ps, nil
}

func (ps *PlatformService) ShutdownMetrics() error {
	if ps.metrics != nil {
		return ps.metrics.stopMetricsServer()
	}

	return nil
}

func (ps *PlatformService) ShutdownConfig() error {
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
		ps.LicenseManager = licenseInterface(ps)
	}
}
