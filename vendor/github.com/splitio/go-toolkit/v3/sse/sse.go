package sse

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/splitio/go-toolkit/v3/logging"
)

const (
	// OK It could connect streaming
	OK = iota
	// ErrorOnClientCreation Could not create client
	ErrorOnClientCreation
	// ErrorRequestPerformed Could not perform request
	ErrorRequestPerformed
	// ErrorConnectToStreaming Could not connect to streaming
	ErrorConnectToStreaming
	// ErrorReadingStream Error in streaming
	ErrorReadingStream
	// ErrorKeepAlive timedout
	ErrorKeepAlive
	// ErrorInternal Internal error for streaming
	ErrorInternal
	// ErrorUnexpected unexpected error occures
	ErrorUnexpected
)

var sseDelimiter [2]byte = [...]byte{':', ' '}
var sseData [4]byte = [...]byte{'d', 'a', 't', 'a'}
var sseKeepAlive [10]byte = [...]byte{':', 'k', 'e', 'e', 'p', 'a', 'l', 'i', 'v', 'e'}

// SSEClient struct
type SSEClient struct {
	url      string
	client   http.Client
	status   chan int
	shutdown chan struct{}
	timeout  int
	logger   logging.LoggerInterface
}

// NewSSEClient creates new SSEClient
func NewSSEClient(url string, status chan int, timeout int, logger logging.LoggerInterface) (*SSEClient, error) {
	if cap(status) < 1 {
		return nil, errors.New("Status channel should have length")
	}
	if timeout < 1 {
		return nil, errors.New("Timeout should be higher than 0")
	}
	return &SSEClient{
		url:      url,
		client:   http.Client{},
		status:   status,
		shutdown: make(chan struct{}, 1),
		timeout:  timeout,
		logger:   logger,
	}, nil
}

// Shutdown stops SSE
func (l *SSEClient) Shutdown() {
	select {
	case l.shutdown <- struct{}{}:
	default:
		l.logger.Error("Awaited unexpected event")
	}
}

func parseData(raw []byte) (map[string]interface{}, error) {
	data := make(map[string]interface{})
	err := json.Unmarshal(raw, &data)
	if err != nil {
		return nil, fmt.Errorf("error parsing json: %w", err)
	}
	return data, nil
}

func (l *SSEClient) readEvent(reader *bufio.Reader) (map[string]interface{}, error) {
	line, err := reader.ReadBytes('\n')
	if err != nil {
		return nil, err
	}

	if len(line) < 2 {
		return nil, nil
	}

	splitted := bytes.Split(line, sseDelimiter[:])

	if bytes.Compare(splitted[0], sseData[:]) != 0 {
		return nil, nil
	}

	raw := bytes.TrimSpace(splitted[1])
	l.logger.Debug("LINE:", string(line))
	data, err := parseData(raw)
	if err != nil {
		l.logger.Error("Error parsing event: ", err)
		return nil, nil
	}

	return data, nil
}

func parseHTTPError(resp *http.Response) int {
	if resp.StatusCode >= http.StatusInternalServerError {
		return ErrorInternal
	}
	return ErrorConnectToStreaming
}

// Do starts streaming
func (l *SSEClient) Do(params map[string]string, callback func(e map[string]interface{})) {
	select {
	case <-l.shutdown:
		// Skipping previous shutdown
	default:
	}
	ctx, cancel := context.WithCancel(context.Background())
	shouldRun := atomic.Value{}
	shouldRun.Store(false)
	activeGoroutines := sync.WaitGroup{}
	defer func() {
		l.logger.Info("SSE streaming exiting")
		cancel()
		shouldRun.Store(false)
		activeGoroutines.Wait()
	}()

	req, err := http.NewRequest("GET", l.url, nil)
	if err != nil {
		l.logger.Error(err)
		l.status <- ErrorOnClientCreation
		return
	}
	req = req.WithContext(ctx)
	query := req.URL.Query()

	for key, value := range params {
		query.Add(key, value)
	}
	req.URL.RawQuery = query.Encode()
	req.Header.Set("Accept", "text/event-stream")

	resp, err := l.client.Do(req)
	if err != nil {
		l.logger.Error(err)
		l.status <- ErrorRequestPerformed
		return
	}

	if resp.StatusCode != 200 {
		l.status <- parseHTTPError(resp)
		return
	}
	defer resp.Body.Close()

	l.status <- OK
	reader := bufio.NewReader(resp.Body)

	eventChannel := make(chan map[string]interface{}, 1000)
	shouldRun.Store(true)
	go func() {
		for shouldRun.Load().(bool) {
			event, err := l.readEvent(reader)
			if err != nil {
				l.logger.Error(err)
				close(eventChannel)
				return
			}
			eventChannel <- event
		}
	}()

	// Create timeout timer in case SSE dont receive notifications or keepalive messages
	idleDuration := time.Duration(l.timeout) * time.Second
	keepAliveTimer := time.NewTimer(idleDuration)
	defer keepAliveTimer.Stop()

	for {
		//  Resetting timer
		keepAliveTimer.Reset(idleDuration)

		select {
		case <-l.shutdown:
			l.logger.Info("Shutting down listener")
			return
		case event, ok := <-eventChannel:
			if !ok {
				l.status <- ErrorReadingStream
				return
			}
			if event != nil {
				activeGoroutines.Add(1)
				go func() {
					defer activeGoroutines.Done()
					callback(event)
				}()
			}
		case <-keepAliveTimer.C: // Timedout
			l.status <- ErrorKeepAlive
			return
		}
	}
}
