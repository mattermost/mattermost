// Copyright 2012-2018 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"net/url"
)

// XPackWatcherRestartService stops the starts the watcher service.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-restart.html.
type XPackWatcherRestartService struct {
	client *Client
	pretty bool
}

// NewXPackWatcherRestartService creates a new XPackWatcherRestartService.
func NewXPackWatcherRestartService(client *Client) *XPackWatcherRestartService {
	return &XPackWatcherRestartService{
		client: client,
	}
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherRestartService) Pretty(pretty bool) *XPackWatcherRestartService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherRestartService) buildURL() (string, url.Values, error) {
	// Build URL path
	path := "/_xpack/watcher/_restart"

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherRestartService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *XPackWatcherRestartService) Do(ctx context.Context) (*XPackWatcherRestartResponse, error) {
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
	ret := new(XPackWatcherRestartResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherRestartResponse is the response of XPackWatcherRestartService.Do.
type XPackWatcherRestartResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
