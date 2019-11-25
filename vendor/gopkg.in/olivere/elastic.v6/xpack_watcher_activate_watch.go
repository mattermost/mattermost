// Copyright 2012-2018 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/olivere/elastic/uritemplates"
)

// XPackWatcherActivateWatchService enables you to activate a currently inactive watch.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-activate-watch.html.
type XPackWatcherActivateWatchService struct {
	client        *Client
	pretty        bool
	watchId       string
	masterTimeout string
}

// NewXPackWatcherActivateWatchService creates a new XPackWatcherActivateWatchService.
func NewXPackWatcherActivateWatchService(client *Client) *XPackWatcherActivateWatchService {
	return &XPackWatcherActivateWatchService{
		client: client,
	}
}

// WatchId is the ID of the watch to activate.
func (s *XPackWatcherActivateWatchService) WatchId(watchId string) *XPackWatcherActivateWatchService {
	s.watchId = watchId
	return s
}

// MasterTimeout specifies an explicit operation timeout for connection to master node.
func (s *XPackWatcherActivateWatchService) MasterTimeout(masterTimeout string) *XPackWatcherActivateWatchService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherActivateWatchService) Pretty(pretty bool) *XPackWatcherActivateWatchService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherActivateWatchService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_xpack/watcher/watch/{watch_id}/_activate", map[string]string{
		"watch_id": s.watchId,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherActivateWatchService) Validate() error {
	var invalid []string
	if s.watchId == "" {
		invalid = append(invalid, "WatchId")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *XPackWatcherActivateWatchService) Do(ctx context.Context) (*XPackWatcherActivateWatchResponse, error) {
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
		Method: "PUT",
		Path:   path,
		Params: params,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(XPackWatcherActivateWatchResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherActivateWatchResponse is the response of XPackWatcherActivateWatchService.Do.
type XPackWatcherActivateWatchResponse struct {
	Status *XPackWatchStatus `json:"status"`
}
