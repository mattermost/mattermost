package synchronizer

import (
	"errors"
	"sync/atomic"
	"time"

	"github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/push"
	"github.com/splitio/go-split-commons/v3/service"
	"github.com/splitio/go-split-commons/v3/storage"
	"github.com/splitio/go-split-commons/v3/telemetry"
	"github.com/splitio/go-toolkit/v4/backoff"
	"github.com/splitio/go-toolkit/v4/logging"
	"github.com/splitio/go-toolkit/v4/struct/traits/lifecycle"
)

const (
	// Ready represents ready
	Ready = iota
	// StreamingReady ready
	StreamingReady
	// Error represents some error in SSE streaming
	Error
)

// Operation mode constants
const (
	Streaming = iota
	Polling
)

// Manager interface
type Manager interface {
	Start()
	Stop()
	IsRunning() bool
}

// ManagerImpl struct
type ManagerImpl struct {
	synchronizer     Synchronizer
	logger           logging.LoggerInterface
	config           conf.AdvancedConfig
	pushManager      push.Manager
	managerStatus    chan int
	streamingStatus  chan int64
	operationMode    int32
	lifecycle        lifecycle.Manager
	backoff          backoff.Interface
	runtimeTelemetry storage.TelemetryRuntimeProducer
}

// NewSynchronizerManager creates new sync manager
func NewSynchronizerManager(
	synchronizer Synchronizer,
	logger logging.LoggerInterface,
	config conf.AdvancedConfig,
	authClient service.AuthClient,
	splitStorage storage.SplitStorage,
	managerStatus chan int,
	runtimeTelemetry storage.TelemetryRuntimeProducer,
	metadata dtos.Metadata,
	clientKey *string,
) (*ManagerImpl, error) {
	if managerStatus == nil || cap(managerStatus) < 1 {
		return nil, errors.New("Status channel cannot be nil nor having capacity")
	}

	manager := &ManagerImpl{
		backoff:          backoff.New(),
		synchronizer:     synchronizer,
		logger:           logger,
		config:           config,
		managerStatus:    managerStatus,
		runtimeTelemetry: runtimeTelemetry,
	}
	manager.lifecycle.Setup()
	if config.StreamingEnabled {
		streamingStatus := make(chan int64, 1000)
		if clientKey != nil && len(*clientKey) != 4 {
			return nil, errors.New("invalid ClientKey")
		}
		pushManager, err := push.NewManager(logger, synchronizer, &config, streamingStatus, authClient, runtimeTelemetry, metadata, clientKey)
		if err != nil {
			return nil, err
		}
		manager.pushManager = pushManager
		manager.streamingStatus = streamingStatus
	}

	return manager, nil
}

// IsRunning returns true if is in Streaming or Polling
func (s *ManagerImpl) IsRunning() bool {
	return s.lifecycle.IsRunning()
}

// Start starts synchronization through Split
func (s *ManagerImpl) Start() {
	if !s.lifecycle.BeginInitialization() {
		s.logger.Info("Manager is already running, skipping start")
		return
	}

	// It's safe to drain the channel here, since it's guaranteed that the  manager status is "starting"
	// push manager is still stopped
	for len(s.managerStatus) > 0 {
		<-s.managerStatus
	}
	err := s.synchronizer.SyncAll(false)
	if err != nil {
		defer s.lifecycle.ShutdownComplete()
		s.managerStatus <- Error
		return
	}

	if !s.lifecycle.InitializationComplete() {
		defer s.lifecycle.ShutdownComplete()
		return
	}
	s.logger.Debug("SyncAll Ready")
	s.managerStatus <- Ready
	s.synchronizer.StartPeriodicDataRecording()

	if !s.config.StreamingEnabled {
		s.logger.Info("SDK initialized in polling mode")
		s.startPolling()
		go func() { // create a goroutine that stops everything (the same way the streaming status watcher would)
			<-s.lifecycle.ShutdownRequested()
			s.stop()
		}()
		return
	}

	// Start streaming
	s.logger.Info("SDK Initialized in streaming mode")
	s.pushManager.Start()
	go s.pushStatusWatcher()
}

func (s *ManagerImpl) stop() {
	if s.pushManager != nil {
		s.pushManager.Stop()
	}
	s.synchronizer.StopPeriodicFetching()
	s.synchronizer.StopPeriodicDataRecording()
	s.lifecycle.ShutdownComplete()
}

// Stop stop synchronizaation through Split
func (s *ManagerImpl) Stop() {
	if !s.lifecycle.BeginShutdown() {
		s.logger.Info("sync manager not yet running, skipping shutdown.")
		return
	}

	s.logger.Info("Stopping all synchronization tasks")
	s.lifecycle.AwaitShutdownComplete()
}

func (s *ManagerImpl) pushStatusWatcher() {
	defer s.stop()
	for {
		select {
		case <-s.lifecycle.ShutdownRequested():
			return
		case status := <-s.streamingStatus:
			switch status {
			case push.StatusUp:
				s.stopPolling()
				s.logger.Info("streaming up and running")
				s.enableStreaming()
				s.synchronizer.SyncAll(true)
			case push.StatusDown:
				s.logger.Info("streaming down, switchin to polling")
				s.synchronizer.SyncAll(false)
				s.pauseStreaming()
				s.startPolling()
			case push.StatusRetryableError:
				howLong := s.backoff.Next()
				s.logger.Error("retryable error in streaming subsystem. Switching to polling and retrying in ", howLong, " seconds")
				s.pushManager.Stop()
				s.synchronizer.SyncAll(false)
				s.startPolling()
				time.Sleep(howLong)
				s.pushManager.Start()
			case push.StatusNonRetryableError:
				s.logger.Error("non retryable error in streaming subsystem. Switching to polling until next SDK initialization")
				s.pushManager.Stop()
				s.synchronizer.SyncAll(false)
				s.startPolling()
				// Tracking STREAMING_DISABLED
				s.runtimeTelemetry.RecordStreamingEvent(telemetry.GetStreamingEvent(telemetry.EventTypeStreamingStatus, telemetry.StreamingDisabled))
			}
		}
	}
}

func (s *ManagerImpl) startPolling() {
	atomic.StoreInt32(&s.operationMode, Polling)
	s.synchronizer.StartPeriodicFetching()
	// Tracking POLLING
	s.runtimeTelemetry.RecordStreamingEvent(telemetry.GetStreamingEvent(telemetry.EventTypeSyncMode, telemetry.Polling))
}

func (s *ManagerImpl) stopPolling() {
	s.synchronizer.StopPeriodicFetching()
}

func (s *ManagerImpl) pauseStreaming() {
	s.pushManager.StartWorkers()
	// Tracking STREAMING_PAUSED
	s.runtimeTelemetry.RecordStreamingEvent(telemetry.GetStreamingEvent(telemetry.EventTypeStreamingStatus, telemetry.StreamingPaused))
}

func (s *ManagerImpl) enableStreaming() {
	s.pushManager.StartWorkers()
	atomic.StoreInt32(&s.operationMode, Streaming)
	s.backoff.Reset()
	// Tracking STREAMING
	s.runtimeTelemetry.RecordStreamingEvent(telemetry.GetStreamingEvent(telemetry.EventTypeSyncMode, telemetry.Streaming))
	// Tracking STREAMING_ENABLED
	s.runtimeTelemetry.RecordStreamingEvent(telemetry.GetStreamingEvent(telemetry.EventTypeStreamingStatus, telemetry.StreamingEnabled))
}
