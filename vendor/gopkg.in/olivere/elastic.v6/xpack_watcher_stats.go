// Copyright 2012-2018 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
)

// XPackWatcherStatsService returns the current watcher metrics.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-stats.html.
type XPackWatcherStatsService struct {
	client          *Client
	pretty          bool
	metric          string
	emitStacktraces *bool
}

// NewXPackWatcherStatsService creates a new XPackWatcherStatsService.
func NewXPackWatcherStatsService(client *Client) *XPackWatcherStatsService {
	return &XPackWatcherStatsService{
		client: client,
	}
}

// Metric controls what additional stat metrics should be include in the response.
func (s *XPackWatcherStatsService) Metric(metric string) *XPackWatcherStatsService {
	s.metric = metric
	return s
}

// EmitStacktraces, if enabled, emits stack traces of currently running watches.
func (s *XPackWatcherStatsService) EmitStacktraces(emitStacktraces bool) *XPackWatcherStatsService {
	s.emitStacktraces = &emitStacktraces
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherStatsService) Pretty(pretty bool) *XPackWatcherStatsService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherStatsService) buildURL() (string, url.Values, error) {
	// Build URL
	path := "/_xpack/watcher/stats"

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	if s.emitStacktraces != nil {
		params.Set("emit_stacktraces", fmt.Sprintf("%v", *s.emitStacktraces))
	}
	if s.metric != "" {
		params.Set("metric", s.metric)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherStatsService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *XPackWatcherStatsService) Do(ctx context.Context) (*XPackWatcherStatsResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, PerformRequestOptions{
		Method: "GET",
		Path:   path,
		Params: params,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(XPackWatcherStatsResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherStatsResponse is the response of XPackWatcherStatsService.Do.
type XPackWatcherStatsResponse struct {
	Stats []XPackWatcherStats `json:"stats"`
}

// XPackWatcherStats represents the stats used in XPackWatcherStatsResponse.
type XPackWatcherStats struct {
	WatcherState        string                 `json:"watcher_state"`
	WatchCount          int                    `json:"watch_count"`
	ExecutionThreadPool map[string]interface{} `json:"execution_thread_pool"`
}
