package sse

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/splitio/go-toolkit/v4/logging"
	"github.com/splitio/go-toolkit/v4/struct/traits/lifecycle"
)

const (
	statusIdle = iota
	statusRunning
	statusShuttingDown

	endOfLineChar = '\n'
	endOfLineStr  = "\n"
)

// Client struct
type Client struct {
	lifecycle lifecycle.Manager
	url       string
	client    http.Client
	timeout   time.Duration
	logger    logging.LoggerInterface
}

// NewClient creates new SSEClient
func NewClient(url string, timeout int, logger logging.LoggerInterface) (*Client, error) {
	if timeout < 1 {
		return nil, errors.New("Timeout should be higher than 0")
	}

	client := &Client{
		url:     url,
		client:  http.Client{},
		timeout: time.Duration(timeout) * time.Second,
		logger:  logger,
	}
	client.lifecycle.Setup()
	return client, nil
}

func (l *Client) readEvents(in *bufio.Reader, out chan<- RawEvent) {
	eventBuilder := NewEventBuilder()
	for {
		line, err := in.ReadString(endOfLineChar)
		l.logger.Debug("Incoming SSE line: ", line)
		if err != nil {
			if l.lifecycle.IsRunning() { // If it's supposed to be running, log an error
				l.logger.Error(err)
			}
			close(out)
			return
		}
		if line != endOfLineStr {
			eventBuilder.AddLine(line)
			continue

		}
		l.logger.Debug("Building SSE event")
		if event := eventBuilder.Build(); event != nil {
			out <- event
		}
		eventBuilder.Reset()
	}
}

// Do starts streaming
func (l *Client) Do(params map[string]string, callback func(e RawEvent)) error {

	if !l.lifecycle.BeginInitialization() {
		return ErrNotIdle
	}

	activeGoroutines := sync.WaitGroup{}

	ctx, cancel := context.WithCancel(context.Background())
	defer func() {
		l.logger.Info("SSE streaming exiting")
		cancel()
		activeGoroutines.Wait()
		l.lifecycle.ShutdownComplete()
	}()

	req, err := l.buildCancellableRequest(ctx, params)
	if err != nil {
		return &ErrConnectionFailed{wrapped: fmt.Errorf("error building request: %w", err)}
	}

	resp, err := l.client.Do(req)
	if err != nil {
		return &ErrConnectionFailed{wrapped: fmt.Errorf("error issuing request: %w", err)}
	}
	if resp.StatusCode != 200 {
		return &ErrConnectionFailed{wrapped: fmt.Errorf("sse request status code: %d", resp.StatusCode)}
	}
	defer resp.Body.Close()

	if !l.lifecycle.InitializationComplete() {
		return nil
	}

	reader := bufio.NewReader(resp.Body)
	eventChannel := make(chan RawEvent, 1000)
	go l.readEvents(reader, eventChannel)

	// Create timeout timer in case SSE dont receive notifications or keepalive messages
	keepAliveTimer := time.NewTimer(l.timeout)
	defer keepAliveTimer.Stop()

	for {
		select {
		case <-l.lifecycle.ShutdownRequested():
			l.logger.Info("Shutting down listener")
			return nil
		case event, ok := <-eventChannel:
			keepAliveTimer.Reset(l.timeout)
			if !ok {
				if l.lifecycle.IsRunning() {
					return ErrReadingStream
				}
				return nil
			}

			if event.IsEmpty() {
				continue // don't forward empty/comment events
			}
			activeGoroutines.Add(1)
			go func() {
				defer activeGoroutines.Done()
				callback(event)
			}()
		case <-keepAliveTimer.C: // Timeout
			l.logger.Warning("SSE idle timeout.")
			l.lifecycle.AbnormalShutdown()
			return ErrTimeout
		}
	}
}

// Shutdown stops SSE
func (l *Client) Shutdown(blocking bool) {
	if !l.lifecycle.BeginShutdown() {
		l.logger.Info("SSE client stopped or shutdown in progress. Ignoring.")
		return
	}

	if blocking {
		l.lifecycle.AwaitShutdownComplete()
	}
}

func (l *Client) buildCancellableRequest(ctx context.Context, params map[string]string) (*http.Request, error) {
	req, err := http.NewRequest("GET", l.url, nil)
	if err != nil {
		return nil, fmt.Errorf("error instantiating request: %w", err)
	}
	req = req.WithContext(ctx)
	query := req.URL.Query()

	for key, value := range params {
		query.Add(key, value)
	}
	req.URL.RawQuery = query.Encode()
	req.Header.Set("Accept", "text/event-stream")
	return req, nil
}
