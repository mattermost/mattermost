// Copyright 2012-2018 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"net/url"
)

// XPackWatcherStartService starts the watcher service if it is not already running.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-start.html.
type XPackWatcherStartService struct {
	client *Client
	pretty bool
}

// NewXPackWatcherStartService creates a new XPackWatcherStartService.
func NewXPackWatcherStartService(client *Client) *XPackWatcherStartService {
	return &XPackWatcherStartService{
		client: client,
	}
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherStartService) Pretty(pretty bool) *XPackWatcherStartService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherStartService) buildURL() (string, url.Values, error) {
	// Build URL path
	path := "/_xpack/watcher/_start"

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherStartService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *XPackWatcherStartService) Do(ctx context.Context) (*XPackWatcherStartResponse, error) {
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
		Method: "POST",
		Path:   path,
		Params: params,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(XPackWatcherStartResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherStartResponse is the response of XPackWatcherStartService.Do.
type XPackWatcherStartResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
