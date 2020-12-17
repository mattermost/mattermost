package sse

import (
	"strings"
	"sync"
	"sync/atomic"

	"github.com/splitio/go-split-commons/v2/conf"
	"github.com/splitio/go-toolkit/v3/logging"
	"github.com/splitio/go-toolkit/v3/sse"
)

const (
	version   = "1.1"
	keepAlive = 120
)

// StreamingClient struct
type StreamingClient struct {
	mutex           *sync.RWMutex
	sseClient       *sse.SSEClient
	sseStatus       chan int
	streamingStatus chan<- int
	running         atomic.Value
	logger          logging.LoggerInterface
	stopped         chan struct{}
}

// NewStreamingClient creates new SSE Client
func NewStreamingClient(cfg *conf.AdvancedConfig, streamingStatus chan int, logger logging.LoggerInterface) *StreamingClient {
	sseStatus := make(chan int, 1)
	sseClient, _ := sse.NewSSEClient(cfg.StreamingServiceURL, sseStatus, keepAlive, logger)
	running := atomic.Value{}
	running.Store(false)

	return &StreamingClient{
		mutex:           &sync.RWMutex{},
		sseClient:       sseClient,
		sseStatus:       sseStatus,
		streamingStatus: streamingStatus,
		logger:          logger,
		running:         running,
		stopped:         make(chan struct{}, 1),
	}
}

// ConnectStreaming connects to streaming
func (s *StreamingClient) ConnectStreaming(token string, channelList []string, handleIncomingMessage func(e map[string]interface{})) {
	params := make(map[string]string)
	params["channels"] = strings.Join(append(channelList), ",")
	params["accessToken"] = token
	params["v"] = version

	httpHandlerExited := make(chan struct{}, 1)
	go func() {
		s.sseClient.Do(params, handleIncomingMessage)
		httpHandlerExited <- struct{}{}
	}()

	// Consume remaining message in completion signaling channel if any:
	select {
	case <-s.stopped:
	default:
	}
	select {
	case <-s.sseStatus:
	default:
	}

	go func() {
		defer func() { // When this goroutine exits, StopStreaming is freed
			select {
			case s.stopped <- struct{}{}:
			default:
			}
		}()
		for {
			select {
			case <-httpHandlerExited:
				return
			case status := <-s.sseStatus:
				switch status {
				case sse.OK:
					s.logger.Info("SSE OK")
					s.running.Store(true)
					s.streamingStatus <- sse.OK
				case sse.ErrorConnectToStreaming:
					s.logger.Error("Error connecting to streaming")
					s.streamingStatus <- sse.ErrorConnectToStreaming
				case sse.ErrorKeepAlive:
					s.logger.Error("Connection timed out")
					s.streamingStatus <- sse.ErrorKeepAlive
				case sse.ErrorOnClientCreation:
					s.logger.Error("Could not create client for streaming")
					s.streamingStatus <- sse.ErrorOnClientCreation
				case sse.ErrorReadingStream:
					s.logger.Error("Error reading streaming buffer")
					s.streamingStatus <- sse.ErrorReadingStream
				case sse.ErrorRequestPerformed:
					s.logger.Error("Error performing request when connect to stream service")
					s.streamingStatus <- sse.ErrorRequestPerformed
				case sse.ErrorInternal:
					s.logger.Error("Internal Error when connect to stream service")
					s.streamingStatus <- sse.ErrorInternal
				default:
					s.logger.Error("Unexpected error occured with streaming")
					s.streamingStatus <- sse.ErrorUnexpected
				}
			}
		}
	}()
}

// StopStreaming stops streaming
func (s *StreamingClient) StopStreaming(blocking bool) {
	s.sseClient.Shutdown()
	s.logger.Info("Stopped streaming")
	s.running.Store(false)
	if blocking {
		<-s.stopped
	}
}

// IsRunning returns true if it's running
func (s *StreamingClient) IsRunning() bool {
	return s.running.Load().(bool)
}
