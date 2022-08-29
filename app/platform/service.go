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
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/cache"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

// PlatformService is the service for the platform related tasks. It is
// responsible for non-entity related functionalities that are required
// by a product such as database access, configuration access, licensing etc.
type PlatformService struct {
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

	licenseValue atomic.Value
	telemetryId  string

	clusterLeaderListeners sync.Map
	clusterIFace           einterfaces.ClusterInterface

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
	}

	if err := ps.initLogging(); err != nil {
		return nil, fmt.Errorf("failed to initialize logging: %w", err)
	}

	if err := ps.resetMetrics(sc.Metrics, ps.configStore.Get); err != nil {
		return nil, err
	}

	// Step 5: Cache provider.
	// At the moment we only have this implementation
	// in the future the cache provider will be built based on the loaded config
	ps.cacheProvider = cache.NewProvider()
	if err2 := ps.cacheProvider.Connect(); err2 != nil {
		return nil, fmt.Errorf("unable to connect to cache provider: %w", err2)
	}

	// Needed before loading license
	var err error
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

	// TODO: platform: remove nil check after store migration completed
	if ps.store != nil {
		if err := ps.ensureAsymmetricSigningKey(); err != nil {
			return nil, fmt.Errorf("unable to ensure asymmetric signing key: %w", err)
		}
	}

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
