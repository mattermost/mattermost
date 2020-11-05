package push

import (
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/splitio/go-split-commons/v2/conf"
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/service"
	"github.com/splitio/go-split-commons/v2/service/api/sse"
	"github.com/splitio/go-split-commons/v2/storage"
	"github.com/splitio/go-toolkit/v3/common"
	"github.com/splitio/go-toolkit/v3/logging"
	sseStatus "github.com/splitio/go-toolkit/v3/sse"
)

const (
	resetTimer = 120
	maxPeriod  = 30 * time.Minute
)

const (
	// Ready represents ready
	Ready = iota
	// PushIsDown there are no publishers for streaming
	PushIsDown
	// PushIsUp there are publishers presents
	PushIsUp
	// BackoffAuth backoff is running for authentication
	BackoffAuth
	// BackoffSSE backoff is running for connecting to stream
	BackoffSSE
	// TokenExpiration flag to restart push services
	TokenExpiration
	// StreamingPaused flag for pausing streaming
	StreamingPaused
	// StreamingResumed flag for resuming streaming
	StreamingResumed
	// StreamingDisabled flag for disabling streaming
	StreamingDisabled
	// Reconnect flag to reconnect
	Reconnect
	// NonRetriableError represents an error that will force switching to polling
	NonRetriableError
)

// PushManager struct for managing push services
type PushManager struct {
	authClient             service.AuthClient
	sseClient              *sse.StreamingClient
	segmentWorker          *SegmentUpdateWorker
	splitWorker            *SplitUpdateWorker
	eventHandler           *EventHandler
	managerStatus          chan<- int
	streamingStatus        chan int
	publishers             chan int
	logger                 logging.LoggerInterface
	cancelAuthBackoff      chan struct{}
	cancelSSEBackoff       chan struct{}
	cancelTokenExpiration  chan struct{}
	cancelStreamingWatcher chan struct{}
	control                chan int
	status                 atomic.Value
}

// NewPushManager creates new PushManager
func NewPushManager(
	logger logging.LoggerInterface,
	synchronizeSegmentHandler func(segmentName string, till *int64) error,
	synchronizeSplitsHandler func(till *int64) error,
	splitStorage storage.SplitStorage,
	config *conf.AdvancedConfig,
	managerStatus chan int,
	authClient service.AuthClient,
) (Manager, error) {
	splitQueue := make(chan dtos.SplitChangeNotification, config.SplitUpdateQueueSize)
	segmentQueue := make(chan dtos.SegmentChangeNotification, config.SegmentUpdateQueueSize)
	control := make(chan int, 1)
	processor, err := NewProcessor(segmentQueue, splitQueue, splitStorage, logger, control)
	if err != nil {
		return nil, err
	}
	parser := NewNotificationParser(logger)
	if parser == nil {
		return nil, errors.New("Could not instantiate NotificationParser")
	}
	publishers := make(chan int, 1000)
	keeper := NewKeeper(publishers)
	if keeper == nil {
		return nil, errors.New("Could not instantiate Keeper")
	}
	eventHandler := NewEventHandler(keeper, parser, processor, logger)
	segmentWorker, err := NewSegmentUpdateWorker(segmentQueue, synchronizeSegmentHandler, logger)
	if err != nil {
		return nil, err
	}
	splitWorker, err := NewSplitUpdateWorker(splitQueue, synchronizeSplitsHandler, logger)
	if err != nil {
		return nil, err
	}

	streamingStatus := make(chan int, 1000)
	status := atomic.Value{}
	status.Store(Ready)
	return &PushManager{
		authClient:             authClient,
		sseClient:              sse.NewStreamingClient(config, streamingStatus, logger),
		segmentWorker:          segmentWorker,
		splitWorker:            splitWorker,
		managerStatus:          managerStatus,
		streamingStatus:        streamingStatus,
		eventHandler:           eventHandler,
		publishers:             publishers,
		logger:                 logger,
		cancelAuthBackoff:      make(chan struct{}, 1),
		cancelSSEBackoff:       make(chan struct{}, 1),
		cancelTokenExpiration:  make(chan struct{}, 1),
		cancelStreamingWatcher: make(chan struct{}, 1),
		control:                control,
		status:                 status,
	}, nil
}

func (p *PushManager) cancelStreaming() {
	p.logger.Error("Error, switching to polling")
	p.managerStatus <- NonRetriableError
}

func (p *PushManager) performAuthentication(errResult chan error) *dtos.Token {
	select {
	case <-p.cancelAuthBackoff:
		// Discarding previous msg
	default:
	}
	tokenResult := make(chan *dtos.Token, 1)
	cancelAuthBackoff := common.WithBackoffCancelling(1*time.Second, maxPeriod, func() bool {
		token, err := p.authClient.Authenticate()
		if err != nil {
			errType, ok := err.(dtos.HTTPError)
			if ok && errType.Code >= http.StatusInternalServerError {
				p.managerStatus <- BackoffAuth
				return false // It will continue retrying
			}
			errResult <- errors.New("Error authenticating")
			return true
		}
		tokenResult <- token
		return true // Result is OK, Stopping Here, no more backoff
	})
	defer cancelAuthBackoff()
	select {
	case token := <-tokenResult:
		if !token.PushEnabled {
			return nil
		}
		return token
	case err := <-errResult:
		p.logger.Error(err.Error())
		return nil
	case <-p.cancelAuthBackoff:
		return nil
	}
}

func (p *PushManager) connectToStreaming(errResult chan error, token string, channels []string) error {
	select {
	case <-p.cancelSSEBackoff:
		// Discarding previous msg
	default:
	}
	sseResult := make(chan struct{}, 1)
	cancelSSEBackoff := common.WithBackoffCancelling(1*time.Second, maxPeriod, func() bool {
		p.sseClient.ConnectStreaming(token, channels, p.eventHandler.HandleIncomingMessage)
		status := <-p.streamingStatus
		switch status {
		case sseStatus.OK:
			sseResult <- struct{}{}
			return true
		case sseStatus.ErrorInternal:
			p.managerStatus <- BackoffSSE
			return false // It will continue retrying
		default:
			errResult <- errors.New("Error connecting streaming")
			return true
		}
	})
	defer cancelSSEBackoff()
	select {
	case <-sseResult:
		return nil
	case err := <-errResult:
		p.logger.Error(err.Error())
		return err
	case <-p.cancelSSEBackoff:
		return nil
	}
}

func (p *PushManager) fetchStreamingToken(errResult chan error) (string, []string, error) {
	token := p.performAuthentication(errResult)
	if token == nil {
		return "", []string{}, errors.New("Could not perform authentication")
	}
	channels, err := token.ChannelList()
	if err != nil {
		return "", []string{}, errors.New("Could not perform authentication")
	}
	nextTokenExpiration, err := token.CalculateNextTokenExpiration()
	if err != nil {
		return "", []string{}, errors.New("Could not perform authentication")
	}
	go func() {
		// Create timeout timer for calculating next token expiration
		idleDuration := nextTokenExpiration
		tokenExpirationTimer := time.NewTimer(idleDuration)
		defer tokenExpirationTimer.Stop()

		select {
		case <-tokenExpirationTimer.C: // Timedout
			p.logger.Info("Token expired")
			p.managerStatus <- TokenExpiration
			return
		case <-p.cancelTokenExpiration:
			return
		}
	}()
	return token.Token, channels, nil
}

func (p *PushManager) streamingStatusWatcher() {
	for {
		select {
		case status := <-p.streamingStatus: // Streaming SSE Status
			switch status {
			case sseStatus.ErrorKeepAlive: // On ConnectionTimedOut -> Reconnect
				fallthrough
			case sseStatus.ErrorInternal: // On Error >= 500 -> Reconnect
				fallthrough
			case sseStatus.ErrorReadingStream: // On IOF -> Reconnect
				p.managerStatus <- Reconnect
			default: // Whatever other errors -> Send Error to disconnect
				p.cancelStreaming()
			}
		case publisherStatus := <-p.publishers: // Publisher Available/Not Available
			switch publisherStatus {
			case PublisherNotPresent:
				if p.status.Load().(int) != StreamingPaused {
					p.managerStatus <- PushIsDown
				}
			case PublisherAvailable:
				if p.status.Load().(int) != StreamingPaused {
					p.managerStatus <- PushIsUp
				}
			default:
				p.logger.Debug(fmt.Sprintf("Unexpected publisher status received %d", publisherStatus))
			}
		case controlStatus := <-p.control:
			switch controlStatus {
			case streamingPaused:
				p.logger.Debug("Received Pause Streaming Notification")
				if p.status.Load().(int) != StreamingPaused {
					p.logger.Info("Sending Pause Streaming")
					p.status.Store(StreamingPaused)
					p.managerStatus <- PushIsDown
				}
			case streamingResumed:
				p.logger.Debug("Received Resume Streaming Notification")
				if p.status.Load().(int) == StreamingPaused {
					p.status.Store(StreamingResumed)
					publishersAvailable := p.eventHandler.keeper.Publishers("control_pri")
					if publishersAvailable != nil && *publishersAvailable > 0 {
						p.logger.Info("Sending Resume Streaming")
						p.managerStatus <- PushIsUp
					}
				}
			case streamingDisabled:
				p.logger.Info("Received Streaming Disabled Notification")
				p.managerStatus <- StreamingDisabled
			default:
				p.logger.Debug(fmt.Sprintf("Unexpected control status received %d", controlStatus))
			}
		case <-p.cancelStreamingWatcher: // Stopping Watcher
			return
		}
	}
}

func (p *PushManager) drainStatus() {
	select {
	case <-p.cancelStreamingWatcher: // Discarding previous msg
	default:
	}
	select {
	case <-p.cancelTokenExpiration: // Discarding previous token expiration
	default:
	}
}

// Start push services
func (p *PushManager) Start() {
	if p.IsRunning() {
		p.logger.Info("PushManager is already running, skipping Start")
		return
	}
	p.drainStatus()

	// errResult listener for fetching token and connecting to SSE
	errResult := make(chan error, 1)
	token, channels, err := p.fetchStreamingToken(errResult)
	if err != nil {
		p.cancelStreaming()
		return
	}
	err = p.connectToStreaming(errResult, token, channels)
	if err != nil {
		p.cancelStreaming()
		return
	}

	// Everything is good, starting workers
	p.splitWorker.Start()
	p.segmentWorker.Start()

	// Sending Ready
	p.managerStatus <- Ready

	// Starting streaming status watcher, it will listen 1) errors in SSE, 2) publishers changes, 3) stop
	go p.streamingStatusWatcher()
}

// Stop push services
func (p *PushManager) Stop() {
	p.logger.Info("Stopping Push Services")
	p.cancelAuthBackoff <- struct{}{}
	p.cancelSSEBackoff <- struct{}{}
	p.cancelTokenExpiration <- struct{}{}
	p.cancelStreamingWatcher <- struct{}{}
	if p.sseClient.IsRunning() {
		p.sseClient.StopStreaming(true)
	}
	p.StopWorkers()
}

// IsRunning returns true if the services are running
func (p *PushManager) IsRunning() bool {
	return p.sseClient.IsRunning() || p.splitWorker.IsRunning() || p.segmentWorker.IsRunning()
}

// StopWorkers stops workers
func (p *PushManager) StopWorkers() {
	if p.splitWorker.IsRunning() {
		p.splitWorker.Stop()
	}
	if p.segmentWorker.IsRunning() {
		p.segmentWorker.Stop()
	}
}

// StartWorkers starts workers
func (p *PushManager) StartWorkers() {
	if !p.splitWorker.IsRunning() {
		p.splitWorker.Start()
	}
	if !p.segmentWorker.IsRunning() {
		p.segmentWorker.Start()
	}
}
