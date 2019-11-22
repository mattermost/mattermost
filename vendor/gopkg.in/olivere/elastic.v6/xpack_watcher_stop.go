// Copyright 2012-2018 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"net/url"
)

// XPackWatcherStopService stops the watcher service if it is running.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-stop.html.
type XPackWatcherStopService struct {
	client *Client
	pretty bool
}

// NewXPackWatcherStopService creates a new XPackWatcherStopService.
func NewXPackWatcherStopService(client *Client) *XPackWatcherStopService {
	return &XPackWatcherStopService{
		client: client,
	}
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherStopService) Pretty(pretty bool) *XPackWatcherStopService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherStopService) buildURL() (string, url.Values, error) {
	// Build URL path
	path := "/_xpack/watcher/_stop"

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherStopService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *XPackWatcherStopService) Do(ctx context.Context) (*XPackWatcherStopResponse, error) {
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
	ret := new(XPackWatcherStopResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherStopResponse is the response of XPackWatcherStopService.Do.
type XPackWatcherStopResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
