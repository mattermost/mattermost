// Package client contains implementations of the Split SDK client and the factory used
// to instantiate it.
package client

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/splitio/go-client/v6/splitio"
	"github.com/splitio/go-client/v6/splitio/conf"
	"github.com/splitio/go-client/v6/splitio/engine"
	"github.com/splitio/go-client/v6/splitio/engine/evaluator"
	impressionlistener "github.com/splitio/go-client/v6/splitio/impressionListener"
	config "github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/provisional"
	"github.com/splitio/go-split-commons/v3/service/api"
	"github.com/splitio/go-split-commons/v3/service/local"
	"github.com/splitio/go-split-commons/v3/storage"
	"github.com/splitio/go-split-commons/v3/storage/inmemory"
	"github.com/splitio/go-split-commons/v3/storage/inmemory/mutexmap"
	"github.com/splitio/go-split-commons/v3/storage/inmemory/mutexqueue"
	"github.com/splitio/go-split-commons/v3/storage/mocks"
	"github.com/splitio/go-split-commons/v3/storage/redis"
	"github.com/splitio/go-split-commons/v3/synchronizer"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/event"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/impression"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/impressionscount"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/segment"
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/split"
	"github.com/splitio/go-split-commons/v3/tasks"
	"github.com/splitio/go-split-commons/v3/telemetry"
	"github.com/splitio/go-toolkit/v4/logging"
)

const (
	sdkStatusDestroyed = iota
	sdkStatusInitializing
	sdkStatusReady

	sdkInitializationFailed = -1
)

type sdkStorages struct {
	splits              storage.SplitStorageConsumer
	segments            storage.SegmentStorageConsumer
	impressions         storage.ImpressionStorageProducer
	events              storage.EventStorageProducer
	initTelemetry       storage.TelemetryConfigProducer
	runtimeTelemetry    storage.TelemetryRuntimeProducer
	evaluationTelemetry storage.TelemetryEvaluationProducer
}

// SplitFactory struct is responsible for instantiating and storing instances of client and manager.
type SplitFactory struct {
	startTime             time.Time // Tracking startTime
	metadata              dtos.Metadata
	storages              sdkStorages
	apikey                string
	status                atomic.Value
	readinessSubscriptors map[int]chan int
	operationMode         string
	mutex                 sync.Mutex
	cfg                   *conf.SplitSdkConfig
	impressionListener    *impressionlistener.WrapperImpressionListener
	logger                logging.LoggerInterface
	syncManager           synchronizer.Manager
	telemetrySync         telemetry.TelemetrySynchronizer // To execute SynchronizeInit
	impressionManager     provisional.ImpressionManager
}

// Client returns the split client instantiated by the factory
func (f *SplitFactory) Client() *SplitClient {
	return &SplitClient{
		logger:      f.logger,
		evaluator:   evaluator.NewEvaluator(f.storages.splits, f.storages.segments, engine.NewEngine(f.logger), f.logger),
		impressions: f.storages.impressions,
		events:      f.storages.events,
		validator: inputValidation{
			logger:       f.logger,
			splitStorage: f.storages.splits,
		},
		factory:             f,
		impressionListener:  f.impressionListener,
		impressionManager:   f.impressionManager,
		initTelemetry:       f.storages.initTelemetry,       // For capturing NonReadyUsages
		runtimeTelemetry:    f.storages.runtimeTelemetry,    // For capturing runtime stats
		evaluationTelemetry: f.storages.evaluationTelemetry, // For capturing treatment stats
	}
}

// Manager returns the split manager instantiated by the factory
func (f *SplitFactory) Manager() *SplitManager {
	return &SplitManager{
		splitStorage:  f.storages.splits,
		validator:     inputValidation{logger: f.logger},
		logger:        f.logger,
		factory:       f,
		initTelemetry: f.storages.initTelemetry, // For capturing NonReadyUsages
	}
}

// IsDestroyed returns true if tbe client has been destroyed
func (f *SplitFactory) IsDestroyed() bool {
	return f.status.Load() == sdkStatusDestroyed
}

// IsReady returns true if the factory is ready
func (f *SplitFactory) IsReady() bool {
	return f.status.Load() == sdkStatusReady
}

// initializates task for localhost mode
func (f *SplitFactory) initializationLocalhost(readyChannel chan int) {
	f.syncManager.Start()

	<-readyChannel
	f.broadcastReadiness(sdkStatusReady, make([]string, 0))
}

// initializates tasks for in-memory mode
func (f *SplitFactory) initializationInMemory(readyChannel chan int) {
	go f.syncManager.Start()
	msg := <-readyChannel
	switch msg {
	case synchronizer.Ready:
		// Broadcast ready status for SDK
		f.broadcastReadiness(sdkStatusReady, make([]string, 0))
	default:
		f.broadcastReadiness(sdkInitializationFailed, make([]string, 0))
	}
}

// recordInitTelemetry In charge of recording init stats from redis and memory
func (f *SplitFactory) recordInitTelemetry(tags []string) {
	if f.telemetrySync == nil {
		f.logger.Debug("Discarding init telemetry")
		return
	}
	f.logger.Debug("Sending init telemetry")
	f.telemetrySync.SynchronizeConfig(
		telemetry.InitConfig{
			AdvancedConfig: config.AdvancedConfig{
				HTTPTimeout:          f.cfg.Advanced.HTTPTimeout,
				SegmentQueueSize:     f.cfg.Advanced.SegmentQueueSize,
				SegmentWorkers:       f.cfg.Advanced.SegmentWorkers,
				SdkURL:               f.cfg.Advanced.SdkURL,
				EventsURL:            f.cfg.Advanced.EventsURL,
				TelemetryServiceURL:  f.cfg.Advanced.TelemetryServiceURL,
				EventsBulkSize:       f.cfg.Advanced.EventsBulkSize,
				EventsQueueSize:      f.cfg.Advanced.EventsQueueSize,
				ImpressionsQueueSize: f.cfg.Advanced.ImpressionsQueueSize,
				ImpressionsBulkSize:  f.cfg.Advanced.ImpressionsBulkSize,
				StreamingEnabled:     f.cfg.Advanced.StreamingEnabled,
				AuthServiceURL:       f.cfg.Advanced.AuthServiceURL,
				StreamingServiceURL:  f.cfg.Advanced.StreamingServiceURL,
			},
			TaskPeriods: config.TaskPeriods(f.cfg.TaskPeriods),
			ManagerConfig: config.ManagerConfig{
				OperationMode:   f.cfg.OperationMode,
				ImpressionsMode: f.cfg.ImpressionsMode,
				ListenerEnabled: f.cfg.Advanced.ImpressionListener != nil,
			},
		},
		time.Now().UTC().Sub(f.startTime).Milliseconds(),
		getFactories(),
		tags,
	)
}

// broadcastReadiness broadcasts message to all the subscriptors
func (f *SplitFactory) broadcastReadiness(status int, tags []string) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	if f.status.Load() == sdkStatusInitializing && status == sdkStatusReady {
		f.status.Store(sdkStatusReady)
	}
	for _, subscriptor := range f.readinessSubscriptors {
		subscriptor <- status
	}
	// At this point the SDK is ready for sending telemetry
	f.recordInitTelemetry(tags)
}

// subscribes listener
func (f *SplitFactory) subscribe(name int, subscriptor chan int) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	f.readinessSubscriptors[name] = subscriptor
}

// removes a particular subscriptor from the list
func (f *SplitFactory) unsubscribe(name int, subscriptor chan int) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	_, ok := f.readinessSubscriptors[name]
	if ok {
		delete(f.readinessSubscriptors, name)
	}
}

// BlockUntilReady blocks client or manager until the SDK is ready, error occurs or times out
func (f *SplitFactory) BlockUntilReady(timer int) error {
	if f.IsReady() {
		return nil
	}
	if timer <= 0 {
		return errors.New("SDK Initialization: timer must be positive number")
	}
	if f.IsDestroyed() {
		return errors.New("SDK Initialization: Client is destroyed")
	}
	block := make(chan int, 1)

	f.mutex.Lock()
	subscriptorName := len(f.readinessSubscriptors)
	f.mutex.Unlock()

	defer func() {
		// Unsubscription will happen only if a block channel has been created
		if block != nil {
			f.unsubscribe(subscriptorName, block)
			close(block)
		}
	}()

	f.subscribe(subscriptorName, block)

	select {
	case status := <-block:
		switch status {
		case sdkStatusReady:
			break
		case sdkInitializationFailed:
			return errors.New("SDK Initialization failed")
		}
	case <-time.After(time.Second * time.Duration(timer)):
		f.storages.initTelemetry.RecordBURTimeout() // Records BURTimeout
		return fmt.Errorf("SDK Initialization: time of %d exceeded", timer)
	}

	return nil
}

// Destroy stops all async tasks and clears all storages
func (f *SplitFactory) Destroy() {
	if !f.IsDestroyed() {
		removeInstanceFromTracker(f.apikey)
	}
	f.status.Store(sdkStatusDestroyed)
	if f.storages.runtimeTelemetry != nil {
		f.storages.runtimeTelemetry.RecordSessionLength(int64(time.Since(f.startTime) * time.Millisecond))
	}

	if f.cfg.OperationMode == conf.RedisConsumer {
		return
	}

	f.syncManager.Stop()
}

// setupLogger sets up the logger according to the parameters submitted by the sdk user
func setupLogger(cfg *conf.SplitSdkConfig) logging.LoggerInterface {
	var logger logging.LoggerInterface
	if cfg.Logger != nil {
		// If a custom logger is supplied, use it.
		logger = cfg.Logger
	} else {
		logger = logging.NewLogger(&cfg.LoggerConfig)
	}
	return logger
}

func setupInMemoryFactory(
	apikey string,
	cfg *conf.SplitSdkConfig,
	logger logging.LoggerInterface,
	metadata dtos.Metadata,
) (*SplitFactory, error) {
	advanced := conf.NormalizeSDKConf(cfg.Advanced)
	if strings.TrimSpace(cfg.SplitSyncProxyURL) != "" {
		advanced.StreamingEnabled = false
	}

	inMememoryFullQueue := make(chan string, 2) // Size 2: So that it's able to accept one event from each resource simultaneously.
	splitsStorage := mutexmap.NewMMSplitStorage()
	segmentsStorage := mutexmap.NewMMSegmentStorage()
	telemetryStorage, err := inmemory.NewTelemetryStorage()
	impressionsStorage := mutexqueue.NewMQImpressionsStorage(cfg.Advanced.ImpressionsQueueSize, inMememoryFullQueue, logger, telemetryStorage)
	eventsStorage := mutexqueue.NewMQEventsStorage(cfg.Advanced.EventsQueueSize, inMememoryFullQueue, logger, telemetryStorage)
	if err != nil {
		return nil, err
	}

	managerConfig := config.ManagerConfig{
		ImpressionsMode: cfg.ImpressionsMode,
		OperationMode:   cfg.OperationMode,
		ListenerEnabled: cfg.Advanced.ImpressionListener != nil,
	}
	splitAPI := api.NewSplitAPI(apikey, advanced, logger, metadata)
	workers := synchronizer.Workers{
		SplitFetcher:       split.NewSplitFetcher(splitsStorage, splitAPI.SplitFetcher, logger, telemetryStorage),
		SegmentFetcher:     segment.NewSegmentFetcher(splitsStorage, segmentsStorage, splitAPI.SegmentFetcher, logger, telemetryStorage),
		EventRecorder:      event.NewEventRecorderSingle(eventsStorage, splitAPI.EventRecorder, logger, metadata, telemetryStorage),
		ImpressionRecorder: impression.NewRecorderSingle(impressionsStorage, splitAPI.ImpressionRecorder, logger, metadata, managerConfig, telemetryStorage),
		TelemetryRecorder:  telemetry.NewTelemetrySynchronizer(telemetryStorage, splitAPI.TelemetryRecorder, splitsStorage, segmentsStorage, logger, metadata, telemetryStorage),
	}
	splitTasks := synchronizer.SplitTasks{
		SplitSyncTask:      tasks.NewFetchSplitsTask(workers.SplitFetcher, cfg.TaskPeriods.SplitSync, logger),
		SegmentSyncTask:    tasks.NewFetchSegmentsTask(workers.SegmentFetcher, cfg.TaskPeriods.SegmentSync, advanced.SegmentWorkers, advanced.SegmentQueueSize, logger),
		EventSyncTask:      tasks.NewRecordEventsTask(workers.EventRecorder, advanced.EventsBulkSize, cfg.TaskPeriods.EventsSync, logger),
		ImpressionSyncTask: tasks.NewRecordImpressionsTask(workers.ImpressionRecorder, cfg.TaskPeriods.ImpressionSync, logger, advanced.ImpressionsBulkSize),
		TelemetrySyncTask:  tasks.NewRecordTelemetryTask(workers.TelemetryRecorder, cfg.TaskPeriods.TelemetrySync, logger),
	}
	var impressionsCounter *provisional.ImpressionsCounter
	if cfg.ImpressionsMode == config.ImpressionsModeOptimized {
		impressionsCounter = provisional.NewImpressionsCounter()
		workers.ImpressionsCountRecorder = impressionscount.NewRecorderSingle(impressionsCounter, splitAPI.ImpressionRecorder, metadata, logger, telemetryStorage)
		splitTasks.ImpressionsCountSyncTask = tasks.NewRecordImpressionsCountTask(workers.ImpressionsCountRecorder, logger)
	}
	impressionManager, err := provisional.NewImpressionManager(managerConfig, impressionsCounter, telemetryStorage)
	if err != nil {
		return nil, err
	}

	syncImpl := synchronizer.NewSynchronizer(
		advanced,
		splitTasks,
		workers,
		logger,
		inMememoryFullQueue,
	)

	readyChannel := make(chan int, 1)
	clientKey := apikey[len(apikey)-4:]
	syncManager, err := synchronizer.NewSynchronizerManager(
		syncImpl,
		logger,
		advanced,
		splitAPI.AuthClient,
		splitsStorage,
		readyChannel,
		telemetryStorage,
		metadata,
		&clientKey,
	)
	if err != nil {
		return nil, err
	}

	splitFactory := SplitFactory{
		startTime:     time.Now().UTC(),
		apikey:        apikey,
		cfg:           cfg,
		metadata:      metadata,
		logger:        logger,
		operationMode: conf.InMemoryStandAlone,
		storages: sdkStorages{
			splits:              splitsStorage,
			events:              eventsStorage,
			impressions:         impressionsStorage,
			segments:            segmentsStorage,
			initTelemetry:       telemetryStorage,
			evaluationTelemetry: telemetryStorage,
			runtimeTelemetry:    telemetryStorage,
		},
		readinessSubscriptors: make(map[int]chan int),
		syncManager:           syncManager,
		telemetrySync:         workers.TelemetryRecorder,
	}
	splitFactory.status.Store(sdkStatusInitializing)
	splitFactory.impressionManager = impressionManager
	setFactory(splitFactory.apikey, splitFactory.logger)

	go splitFactory.initializationInMemory(readyChannel)

	return &splitFactory, nil
}

func setupRedisFactory(apikey string, cfg *conf.SplitSdkConfig, logger logging.LoggerInterface, metadata dtos.Metadata) (*SplitFactory, error) {
	redisClient, err := redis.NewRedisClient(&cfg.Redis, logger)
	if err != nil {
		logger.Error("Failed to instantiate redis client.")
		return nil, err
	}

	telemetryStorage := redis.NewTelemetryStorage(redisClient, logger, metadata)
	storages := sdkStorages{
		splits:              redis.NewSplitStorage(redisClient, logger),
		segments:            redis.NewSegmentStorage(redisClient, logger),
		impressions:         redis.NewImpressionStorage(redisClient, metadata, logger),
		events:              redis.NewEventsStorage(redisClient, metadata, logger),
		initTelemetry:       telemetryStorage,
		evaluationTelemetry: telemetryStorage,
	}

	factory := &SplitFactory{
		startTime:             time.Now().UTC(),
		apikey:                apikey,
		cfg:                   cfg,
		metadata:              metadata,
		logger:                logger,
		operationMode:         conf.RedisConsumer,
		storages:              storages,
		readinessSubscriptors: make(map[int]chan int),
		telemetrySync:         telemetry.NewSynchronizerRedis(telemetryStorage, logger),
	}
	factory.status.Store(sdkStatusInitializing)
	impressionManager, err := provisional.NewImpressionManager(config.ManagerConfig{
		OperationMode:   cfg.OperationMode,
		ImpressionsMode: cfg.ImpressionsMode,
		ListenerEnabled: cfg.Advanced.ImpressionListener != nil,
	}, nil, mocks.MockTelemetryStorage{
		RecordSyncLatencyCall:      func(resource int, latency int64) {},
		RecordImpressionsStatsCall: func(dataType int, count int64) {},
	})
	if err != nil {
		return nil, err
	}
	factory.impressionManager = impressionManager
	setFactory(factory.apikey, factory.logger)
	factory.broadcastReadiness(sdkStatusReady, make([]string, 0))
	return factory, nil
}

func setupLocalhostFactory(
	apikey string,
	cfg *conf.SplitSdkConfig,
	logger logging.LoggerInterface,
	metadata dtos.Metadata,
) (*SplitFactory, error) {
	splitStorage := mutexmap.NewMMSplitStorage()
	telemetryStorage, err := inmemory.NewTelemetryStorage()
	if err != nil {
		return nil, err
	}
	splitPeriod := cfg.TaskPeriods.SplitSync
	readyChannel := make(chan int, 1)
	splitAPI := &api.SplitAPI{SplitFetcher: local.NewFileSplitFetcher(cfg.SplitFile, logger)}
	syncManager, err := synchronizer.NewSynchronizerManager(
		synchronizer.NewLocal(splitPeriod, splitAPI, splitStorage, logger, telemetryStorage),
		logger,
		config.AdvancedConfig{StreamingEnabled: false},
		nil,
		splitStorage,
		readyChannel,
		telemetryStorage,
		metadata,
		nil,
	)

	if err != nil {
		return nil, err
	}

	splitFactory := &SplitFactory{
		startTime: time.Now().UTC(),
		apikey:    apikey,
		cfg:       cfg,
		metadata:  metadata,
		logger:    logger,
		storages: sdkStorages{
			splits:              splitStorage,
			impressions:         mutexqueue.NewMQImpressionsStorage(cfg.Advanced.ImpressionsQueueSize, make(chan string, 1), logger, telemetryStorage),
			events:              mutexqueue.NewMQEventsStorage(cfg.Advanced.EventsQueueSize, make(chan string, 1), logger, telemetryStorage),
			segments:            mutexmap.NewMMSegmentStorage(),
			initTelemetry:       telemetryStorage,
			evaluationTelemetry: telemetryStorage,
			runtimeTelemetry:    telemetryStorage,
		},
		readinessSubscriptors: make(map[int]chan int),
		syncManager:           syncManager,
	}
	splitFactory.status.Store(sdkStatusInitializing)

	impressionManager, err := provisional.NewImpressionManager(config.ManagerConfig{
		OperationMode:   cfg.OperationMode,
		ImpressionsMode: cfg.ImpressionsMode,
		ListenerEnabled: cfg.Advanced.ImpressionListener != nil,
	}, nil, telemetryStorage)
	if err != nil {
		return nil, err
	}
	splitFactory.impressionManager = impressionManager
	setFactory(splitFactory.apikey, splitFactory.logger)

	// Call fetching tasks as goroutine
	go splitFactory.initializationLocalhost(readyChannel)

	return splitFactory, nil
}

// newFactory instantiates a new SplitFactory object. Accepts a SplitSdkConfig struct as an argument,
// which will be used to instantiate both the client and the manager
func newFactory(apikey string, cfg *conf.SplitSdkConfig, logger logging.LoggerInterface) (*SplitFactory, error) {
	metadata := dtos.Metadata{
		SDKVersion:  "go-" + splitio.Version,
		MachineIP:   cfg.IPAddress,
		MachineName: cfg.InstanceName,
	}

	var splitFactory *SplitFactory
	var err error

	switch cfg.OperationMode {
	case conf.InMemoryStandAlone:
		splitFactory, err = setupInMemoryFactory(apikey, cfg, logger, metadata)
	case conf.RedisConsumer:
		splitFactory, err = setupRedisFactory(apikey, cfg, logger, metadata)
	case conf.Localhost:
		splitFactory, err = setupLocalhostFactory(apikey, cfg, logger, metadata)
	default:
		err = fmt.Errorf("Invalid operation mode \"%s\"", cfg.OperationMode)
	}

	if err != nil {
		return nil, err
	}

	if cfg.Advanced.ImpressionListener != nil {
		splitFactory.impressionListener = impressionlistener.NewImpressionListenerWrapper(
			cfg.Advanced.ImpressionListener,
			metadata,
		)
	}

	return splitFactory, nil
}
