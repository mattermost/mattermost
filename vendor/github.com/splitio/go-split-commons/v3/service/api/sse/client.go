package sse

import (
	"errors"
	"strings"

	"github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-toolkit/v4/logging"
	"github.com/splitio/go-toolkit/v4/sse"
	"github.com/splitio/go-toolkit/v4/struct/traits/lifecycle"
	gtSync "github.com/splitio/go-toolkit/v4/sync"
)

const (
	version   = "1.1"
	keepAlive = 70
)

// StreamingClient interface
type StreamingClient interface {
	ConnectStreaming(token string, streamingStatus chan int, channelList []string, handleIncomingMessage func(IncomingMessage))
	StopStreaming()
	IsRunning() bool
}

// StreamingClientImpl struct
type StreamingClientImpl struct {
	sseClient *sse.Client
	logger    logging.LoggerInterface
	lifecycle lifecycle.Manager
}

// Status constants
const (
	StatusConnectionFailed = iota
	StatusUnderlyingClientInUse
	StatusFirstEventOk
	StatusDisconnected
)

// IncomingMessage is an alias of sse.RawEvent
type IncomingMessage = sse.RawEvent

// NewStreamingClient creates new SSE Client
func NewStreamingClient(cfg *conf.AdvancedConfig, logger logging.LoggerInterface) *StreamingClientImpl {
	sseClient, _ := sse.NewClient(cfg.StreamingServiceURL, keepAlive, logger)

	client := &StreamingClientImpl{
		sseClient: sseClient,
		logger:    logger,
	}
	client.lifecycle.Setup()
	return client
}

// ConnectStreaming connects to streaming
func (s *StreamingClientImpl) ConnectStreaming(token string, streamingStatus chan int, channelList []string, handleIncomingMessage func(IncomingMessage)) {

	if !s.lifecycle.BeginInitialization() {
		s.logger.Info("Connection is already in process/running. Ignoring")
		return
	}

	params := make(map[string]string)
	params["channels"] = strings.Join(append(channelList), ",")
	params["accessToken"] = token
	params["v"] = version

	go func() {
		defer s.lifecycle.ShutdownComplete()
		if !s.lifecycle.InitializationComplete() {
			return
		}
		firstEventReceived := gtSync.NewAtomicBool(false)
		out := s.sseClient.Do(params, func(m IncomingMessage) {
			if firstEventReceived.TestAndSet() && !m.IsError() {
				streamingStatus <- StatusFirstEventOk
			}
			handleIncomingMessage(m)
		})

		if out == nil { // all good
			streamingStatus <- StatusDisconnected
			return
		}

		// Something didn'g go as expected
		s.lifecycle.AbnormalShutdown()

		asConnectionFailedError := &sse.ErrConnectionFailed{}
		if errors.As(out, &asConnectionFailedError) {
			streamingStatus <- StatusConnectionFailed
			return
		}

		switch out {
		case sse.ErrNotIdle:
			// If this happens we have a bug
			streamingStatus <- StatusUnderlyingClientInUse
		case sse.ErrReadingStream:
			streamingStatus <- StatusDisconnected
		case sse.ErrTimeout:
			streamingStatus <- StatusDisconnected
		default:
		}
	}()
}

// StopStreaming stops streaming
func (s *StreamingClientImpl) StopStreaming() {
	if !s.lifecycle.BeginShutdown() {
		s.logger.Info("SSE client wrapper not running. Ignoring")
		return
	}
	s.sseClient.Shutdown(true)
	s.lifecycle.AwaitShutdownComplete()
	s.logger.Info("Stopped streaming")
}

// IsRunning returns true if the client is running
func (s *StreamingClientImpl) IsRunning() bool {
	return s.lifecycle.IsRunning()
}
