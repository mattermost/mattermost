package telemetry

import (
	"os"
	"strings"
	"time"

	"github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/service"
	"github.com/splitio/go-split-commons/v3/storage"
	"github.com/splitio/go-toolkit/v4/logging"
)

// RecorderSingle struct for telemetry sync
type RecorderSingle struct {
	telemetryStorage  storage.TelemetryStorageConsumer
	telemetryRecorder service.TelemetryRecorder
	splitStorage      storage.SplitStorageConsumer
	segmentStorage    storage.SegmentStorageConsumer
	logger            logging.LoggerInterface
	metadata          dtos.Metadata
	runtimeTelemetry  storage.TelemetryRuntimeProducer
}

// NewTelemetrySynchronizer creates new event synchronizer for posting events
func NewTelemetrySynchronizer(
	telemetryStorage storage.TelemetryStorageConsumer,
	telemetryRecorder service.TelemetryRecorder,
	splitStorage storage.SplitStorageConsumer,
	segmentStorage storage.SegmentStorageConsumer,
	logger logging.LoggerInterface,
	metadata dtos.Metadata,
	runtimeTelemetry storage.TelemetryRuntimeProducer,
) TelemetrySynchronizer {
	return &RecorderSingle{
		telemetryStorage:  telemetryStorage,
		telemetryRecorder: telemetryRecorder,
		splitStorage:      splitStorage,
		segmentStorage:    segmentStorage,
		logger:            logger,
		metadata:          metadata,
		runtimeTelemetry:  runtimeTelemetry,
	}
}

func (e *RecorderSingle) buildStats() dtos.Stats {
	methodLatencies := e.telemetryStorage.PopLatencies()
	methodExceptions := e.telemetryStorage.PopExceptions()
	lastSynchronization := e.telemetryStorage.GetLastSynchronization()
	httpErrors := e.telemetryStorage.PopHTTPErrors()
	httpLatencies := e.telemetryStorage.PopHTTPLatencies()
	return dtos.Stats{
		MethodLatencies:      &methodLatencies,
		MethodExceptions:     &methodExceptions,
		ImpressionsDropped:   e.telemetryStorage.GetImpressionsStats(ImpressionsDropped),
		ImpressionsDeduped:   e.telemetryStorage.GetImpressionsStats(ImpressionsDeduped),
		ImpressionsQueued:    e.telemetryStorage.GetImpressionsStats(ImpressionsQueued),
		EventsQueued:         e.telemetryStorage.GetEventsStats(EventsQueued),
		EventsDropped:        e.telemetryStorage.GetEventsStats(EventsDropped),
		LastSynchronizations: &lastSynchronization,
		HTTPErrors:           &httpErrors,
		HTTPLatencies:        &httpLatencies,
		SplitCount:           int64(len(e.splitStorage.SplitNames())),
		SegmentCount:         int64(e.splitStorage.SegmentNames().Size()),
		SegmentKeyCount:      e.segmentStorage.SegmentKeysCount(),
		TokenRefreshes:       e.telemetryStorage.PopTokenRefreshes(),
		AuthRejections:       e.telemetryStorage.PopAuthRejections(),
		StreamingEvents:      e.telemetryStorage.PopStreamingEvents(),
		SessionLengthMs:      e.telemetryStorage.GetSessionLength(),
		Tags:                 e.telemetryStorage.PopTags(),
	}
}

// SynchronizeStats syncs telemetry stats
func (e *RecorderSingle) SynchronizeStats() error {
	stats := e.buildStats()

	before := time.Now()
	err := e.telemetryRecorder.RecordStats(stats, e.metadata)
	if err != nil {
		if httpError, ok := err.(*dtos.HTTPError); ok {
			e.runtimeTelemetry.RecordSyncError(TelemetrySync, httpError.Code)
		}
		return err
	}
	e.runtimeTelemetry.RecordSyncLatency(TelemetrySync, time.Since(before).Nanoseconds())
	e.runtimeTelemetry.RecordSuccessfulSync(TelemetrySync, time.Now().UTC().UnixNano()/int64(time.Millisecond))
	return nil
}

// SynchronizeConfig syncs telemetry config
func (e *RecorderSingle) SynchronizeConfig(cfg InitConfig, timedUntilReady int64, factoryInstances map[string]int64, tags []string) {
	urlOverrides := getURLOverrides(cfg.AdvancedConfig)

	impressionsMode := ImpressionsModeOptimized
	if cfg.ManagerConfig.ImpressionsMode == conf.ImpressionsModeDebug {
		impressionsMode = ImpressionsModeDebug
	}

	before := time.Now()
	err := e.telemetryRecorder.RecordConfig(dtos.Config{
		OperationMode:      Standalone,
		Storage:            Memory,
		ActiveFactories:    int64(len(factoryInstances)),
		RedundantFactories: getRedudantActiveFactories(factoryInstances),
		Tags:               tags,
		StreamingEnabled:   cfg.AdvancedConfig.StreamingEnabled,
		Rates: &dtos.Rates{
			Splits:      int64(cfg.TaskPeriods.SplitSync),
			Segments:    int64(cfg.TaskPeriods.SegmentSync),
			Impressions: int64(cfg.TaskPeriods.ImpressionSync),
			Events:      int64(cfg.TaskPeriods.EventsSync),
			Telemetry:   int64(cfg.TaskPeriods.TelemetrySync),
		},
		URLOverrides:               &urlOverrides,
		ImpressionsQueueSize:       int64(cfg.AdvancedConfig.ImpressionsQueueSize),
		EventsQueueSize:            int64(cfg.AdvancedConfig.EventsQueueSize),
		ImpressionsMode:            impressionsMode,
		ImpressionsListenerEnabled: cfg.ManagerConfig.ListenerEnabled,
		HTTPProxyDetected:          len(strings.TrimSpace(os.Getenv("HTTP_PROXY"))) > 0,
		TimeUntilReady:             timedUntilReady,
		BurTimeouts:                e.telemetryStorage.GetBURTimeouts(),
		NonReadyUsages:             e.telemetryStorage.GetNonReadyUsages(),
	}, e.metadata)
	if err != nil {
		e.logger.Error("Could not log config data", err.Error())
		if httpError, ok := err.(*dtos.HTTPError); ok {
			e.runtimeTelemetry.RecordSyncError(TelemetrySync, httpError.Code)
		}
		return
	}
	e.runtimeTelemetry.RecordSyncLatency(TelemetrySync, time.Since(before).Nanoseconds())
	e.runtimeTelemetry.RecordSuccessfulSync(TelemetrySync, time.Now().UTC().UnixNano()/int64(time.Millisecond))
}
