package synchronizer

import (
	"errors"
	"sync/atomic"

	"github.com/splitio/go-split-commons/v2/conf"
	"github.com/splitio/go-split-commons/v2/push"
	"github.com/splitio/go-split-commons/v2/service"
	"github.com/splitio/go-split-commons/v2/storage"
	"github.com/splitio/go-toolkit/v3/logging"
)

const (
	// Ready represents ready
	Ready = iota
	// StreamingReady ready
	StreamingReady
	// Error represents some error in SSE streaming
	Error
)

const (
	// Idle flags
	Idle = iota
	// Streaming flags
	Streaming
	// Polling flags
	Polling
)

// Manager struct
type Manager struct {
	synchronizer    Synchronizer
	logger          logging.LoggerInterface
	config          conf.AdvancedConfig
	pushManager     push.Manager
	managerStatus   chan int
	streamingStatus chan int
	status          atomic.Value
}

// NewSynchronizerManager creates new sync manager
func NewSynchronizerManager(
	synchronizer Synchronizer,
	logger logging.LoggerInterface,
	config conf.AdvancedConfig,
	authClient service.AuthClient,
	splitStorage storage.SplitStorage,
	managerStatus chan int,
) (*Manager, error) {
	if managerStatus == nil || cap(managerStatus) < 1 {
		return nil, errors.New("Status channel cannot be nil nor having capacity")
	}

	status := atomic.Value{}
	status.Store(Idle)
	manager := &Manager{
		synchronizer:  synchronizer,
		logger:        logger,
		config:        config,
		managerStatus: managerStatus,
		status:        status,
	}
	if config.StreamingEnabled {
		streamingStatus := make(chan int, 1000)
		pushManager, err := push.NewPushManager(logger, synchronizer.SynchronizeSegment, synchronizer.SynchronizeSplits, splitStorage, &config, streamingStatus, authClient)
		if err != nil {
			return nil, err
		}
		manager.pushManager = pushManager
		manager.streamingStatus = streamingStatus
	}

	return manager, nil
}

func (s *Manager) startPolling() {
	s.status.Store(Polling)
	s.pushManager.StopWorkers()
	s.synchronizer.StartPeriodicFetching()
}

// IsRunning returns true if is in Streaming or Polling
func (s *Manager) IsRunning() bool {
	return s.status.Load().(int) != Idle
}

// Start starts synchronization through Split
func (s *Manager) Start() {
	if s.IsRunning() {
		s.logger.Info("Manager is already running, skipping start")
		return
	}
	select {
	case <-s.managerStatus:
		// Discarding previous status before starting
	default:
	}
	err := s.synchronizer.SyncAll()
	if err != nil {
		s.managerStatus <- Error
		return
	}
	s.logger.Debug("SyncAll Ready")
	s.managerStatus <- Ready
	s.synchronizer.StartPeriodicDataRecording()
	if s.config.StreamingEnabled {
		s.logger.Info("Start Streaming")
		go s.pushManager.Start()
		// Listens Streaming Status
		for {
			status := <-s.streamingStatus
			switch status {
			// Backoff is running -> start polling until auth is ok
			case push.BackoffAuth:
				fallthrough
			// Backoff is running -> start polling until sse is connected
			case push.BackoffSSE:
				if s.status.Load().(int) != Polling {
					s.logger.Info("Start periodic polling due backoff")
					s.startPolling()
				}
			// SSE Streaming and workers are ready
			case push.Ready:
				// If Ready comes eventually when Backoff is done and polling is running
				if s.status.Load().(int) == Polling {
					s.synchronizer.StopPeriodicFetching()
				}
				s.logger.Info("SSE Streaming is ready")
				s.status.Store(Streaming)
				go s.synchronizer.SyncAll()
			case push.StreamingDisabled:
				fallthrough
			// NonRetriableError occurs and it will switch to polling
			case push.NonRetriableError:
				s.pushManager.Stop()
				s.logger.Info("Start periodic polling in Streaming")
				s.startPolling()
				return
			// Publisher sends that there is no Notification Managers available
			case push.PushIsDown:
				// If streaming is already running, proceeding to stop workers
				// and keeping SSE running
				if s.status.Load().(int) == Streaming {
					s.logger.Info("Start periodic polling in Streaming")
					s.startPolling()
				}
			// Publisher sends that there are at least one Notification Manager available
			case push.PushIsUp:
				// If streaming is not already running, proceeding to start workers
				if s.status.Load().(int) != Streaming {
					s.logger.Info("Stop periodic polling")
					s.pushManager.StartWorkers()
					s.synchronizer.StopPeriodicFetching()
					s.status.Store(Streaming)
					go s.synchronizer.SyncAll()
				}
			// Reconnect received due error in streaming -> reconnecting
			case push.Reconnect:
				fallthrough
			// Token expired -> reconnecting
			case push.TokenExpiration:
				s.pushManager.Stop()
				go s.pushManager.Start()
			}
		}
	} else {
		s.logger.Info("Start periodic polling")
		s.synchronizer.StartPeriodicFetching()
		s.status.Store(Polling)
	}
}

// Stop stop synchronizaation through Split
func (s *Manager) Stop() {
	s.logger.Info("STOPPING MANAGER TASKS")
	if s.pushManager != nil && s.pushManager.IsRunning() {
		s.pushManager.Stop()
	}
	s.synchronizer.StopPeriodicFetching()
	s.synchronizer.StopPeriodicDataRecording()
	s.status.Store(Idle)
}
