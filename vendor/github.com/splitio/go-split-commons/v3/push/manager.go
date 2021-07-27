package push

import (
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/service"
	"github.com/splitio/go-split-commons/v3/service/api/sse"
	"github.com/splitio/go-split-commons/v3/storage"
	"github.com/splitio/go-split-commons/v3/telemetry"
	"github.com/splitio/go-toolkit/v4/common"
	"github.com/splitio/go-toolkit/v4/logging"
	"github.com/splitio/go-toolkit/v4/struct/traits/lifecycle"
)

// Status update contants that will be propagated to the push manager's user
const (
	StatusUp = iota
	StatusDown
	StatusRetryableError
	StatusNonRetryableError
)

// ErrAlreadyRunning is the error to be returned when .Start() is called on an already running instance
var ErrAlreadyRunning = errors.New("push manager already running")

// ErrNotRunning is the error to be returned when .Stop() is called on a non-running instance
var ErrNotRunning = errors.New("push manager not running")

// Manager interface contains public methods for push manager
type Manager interface {
	Start() error
	Stop() error
	StopWorkers()
	StartWorkers()
}

// ManagerImpl implements the manager interface
type ManagerImpl struct {
	parser            NotificationParser
	sseClient         sse.StreamingClient
	authAPI           service.AuthClient
	processor         Processor
	statusTracker     StatusTracker
	feedback          FeedbackLoop
	nextRefresh       *time.Timer
	refreshTokenMutex sync.Mutex
	lifecycle         lifecycle.Manager
	logger            logging.LoggerInterface
	runtimeTelemetry  storage.TelemetryRuntimeProducer
}

// FeedbackLoop is a type alias for the type of chan that must be supplied for push status tobe propagated
type FeedbackLoop = chan<- int64

// NewManager constructs a new push manager
func NewManager(
	logger logging.LoggerInterface,
	synchronizer synchronizerInterface,
	cfg *conf.AdvancedConfig,
	feedbackLoop chan<- int64,
	authAPI service.AuthClient,
	runtimeTelemetry storage.TelemetryRuntimeProducer,
	metadata dtos.Metadata,
	clientKey *string,
) (*ManagerImpl, error) {

	processor, err := NewProcessor(cfg.SplitUpdateQueueSize, cfg.SegmentUpdateQueueSize, synchronizer, logger)
	if err != nil {
		return nil, fmt.Errorf("error instantiating processor: %w", err)
	}

	statusTracker := NewStatusTracker(logger, runtimeTelemetry)
	parser := &NotificationParserImpl{
		logger:            logger,
		onSplitUpdate:     processor.ProcessSplitChangeUpdate,
		onSplitKill:       processor.ProcessSplitKillUpdate,
		onSegmentUpdate:   processor.ProcessSegmentChangeUpdate,
		onControlUpdate:   statusTracker.HandleControl,
		onOccupancyMesage: statusTracker.HandleOccupancy,
		onAblyError:       statusTracker.HandleAblyError,
	}

	manager := &ManagerImpl{
		authAPI:          authAPI,
		sseClient:        sse.NewStreamingClient(cfg, logger, metadata, clientKey),
		statusTracker:    statusTracker,
		feedback:         feedbackLoop,
		processor:        processor,
		parser:           parser,
		logger:           logger,
		runtimeTelemetry: runtimeTelemetry,
	}
	manager.lifecycle.Setup()
	return manager, nil
}

// Start initiates the authentication flow and if successful initiates a connection
func (m *ManagerImpl) Start() error {
	if !m.lifecycle.BeginInitialization() {
		return ErrAlreadyRunning
	}
	m.triggerConnectionFlow()
	return nil
}

// Stop method stops the sse client and it's status monitoring goroutine
func (m *ManagerImpl) Stop() error {
	if !m.lifecycle.BeginShutdown() {
		return ErrNotRunning
	}
	m.statusTracker.NotifySSEShutdownExpected()
	m.withRefreshTokenLock(func() {
		if m.nextRefresh != nil {
			m.nextRefresh.Stop()
		}
	})
	m.StopWorkers()
	m.sseClient.StopStreaming()
	m.lifecycle.AwaitShutdownComplete()
	return nil
}

// StartWorkers start the splits & segments workers
func (m *ManagerImpl) StartWorkers() {
	m.processor.StartWorkers()
}

// StopWorkers stops the splits & segments workers
func (m *ManagerImpl) StopWorkers() {
	m.processor.StopWorkers()
}

func (m *ManagerImpl) performAuthentication() (*dtos.Token, *int64) {
	before := time.Now()
	token, err := m.authAPI.Authenticate()
	if err != nil {
		if errType, ok := err.(dtos.HTTPError); ok {
			m.runtimeTelemetry.RecordSyncError(telemetry.TokenSync, errType.Code)
			if errType.Code >= http.StatusInternalServerError {
				m.logger.Error(fmt.Sprintf("Error authenticating: %s", err.Error()))
				return nil, common.Int64Ref(StatusRetryableError)
			}
			if errType.Code == http.StatusUnauthorized {
				m.runtimeTelemetry.RecordAuthRejections() // Only 401
			}
			return nil, common.Int64Ref(StatusNonRetryableError) // 400, 401, etc
		}
		// Not an HTTP error, most likely a tcp/bad connection. Should retry
		return nil, common.Int64Ref(StatusRetryableError)
	}
	m.runtimeTelemetry.RecordSyncLatency(telemetry.TokenSync, time.Since(before).Nanoseconds())
	if !token.PushEnabled {
		return nil, common.Int64Ref(StatusNonRetryableError)
	}
	m.runtimeTelemetry.RecordTokenRefreshes()
	m.runtimeTelemetry.RecordSuccessfulSync(telemetry.TokenSync, time.Now().UTC().UnixNano()/int64(time.Millisecond))
	return token, nil
}

func (m *ManagerImpl) eventHandler(e sse.IncomingMessage) {
	newStatus, err := m.parser.ParseAndForward(e)
	if newStatus != nil {
		m.feedback <- *newStatus
	} else if err != nil {
		m.logger.Error("error parsing message: ", err)
		m.logger.Debug("failed message: ", e)
		m.feedback <- StatusRetryableError
	}
}

func (m *ManagerImpl) triggerConnectionFlow() {
	token, status := m.performAuthentication()
	if status != nil {
		m.lifecycle.AbnormalShutdown()
		defer m.lifecycle.ShutdownComplete()
		m.feedback <- *status
		return
	}

	tokenList, err := token.ChannelList()
	if err != nil {
		m.logger.Error("error parsing channel list: ", err)
		m.lifecycle.AbnormalShutdown()
		defer m.lifecycle.ShutdownComplete()
		m.feedback <- StatusRetryableError
		return
	}

	m.statusTracker.Reset()
	sseStatus := make(chan int, 100)
	m.sseClient.ConnectStreaming(token.Token, sseStatus, tokenList, m.eventHandler)
	go func() {
		defer m.lifecycle.ShutdownComplete()
		if !m.lifecycle.InitializationComplete() {
			return
		}
		for {
			message := <-sseStatus
			switch message {
			case sse.StatusFirstEventOk:
				when, err := token.CalculateNextTokenExpiration()
				if err != nil || when <= 0 {
					m.logger.Warning("Failed to calculate next token expiration time. Defaulting to 50 minutes")
					when = 50 * time.Minute
				}
				// Tracking TOKEN_REFRESHES
				m.runtimeTelemetry.RecordStreamingEvent(telemetry.GetStreamingEvent(telemetry.EventTypeTokenRefresh, when.Milliseconds()))
				m.withRefreshTokenLock(func() {
					m.nextRefresh = time.AfterFunc(when, func() {
						m.logger.Info("Refreshing SSE auth token.")
						m.Stop()
						m.Start()
					})
				})
				// Tracking CONNECTION_ESTABLISHED
				m.runtimeTelemetry.RecordStreamingEvent(telemetry.GetStreamingEvent(telemetry.EventTypeSSEConnectionEstablished, 0))
				m.feedback <- StatusUp
			case sse.StatusConnectionFailed:
				m.lifecycle.AbnormalShutdown()
				m.logger.Error("SSE Connection failed")
				m.feedback <- StatusRetryableError
				return
			case sse.StatusDisconnected:
				m.logger.Debug("propagating sse disconnection event")
				status := m.statusTracker.HandleDisconnection()
				if status != nil { // connection ended unexpectedly
					m.lifecycle.AbnormalShutdown()
					m.feedback <- *status
				}
				return
			case sse.StatusUnderlyingClientInUse:
				m.lifecycle.AbnormalShutdown()
				m.logger.Error("unexpected error in streaming. Switching to polling")
				m.feedback <- StatusNonRetryableError
				return
			}
		}
	}()
}

func (m *ManagerImpl) withRefreshTokenLock(f func()) {
	m.refreshTokenMutex.Lock()
	defer m.refreshTokenMutex.Unlock()
	f()
}
