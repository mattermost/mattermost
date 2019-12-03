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

// XPackWatcherDeactivateWatchService enables you to deactivate a currently active watch.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-deactivate-watch.html.
type XPackWatcherDeactivateWatchService struct {
	client        *Client
	pretty        bool
	watchId       string
	masterTimeout string
	bodyJson      interface{}
	bodyString    string
}

// NewXPackWatcherDeactivateWatchService creates a new XPackWatcherDeactivateWatchService.
func NewXPackWatcherDeactivateWatchService(client *Client) *XPackWatcherDeactivateWatchService {
	return &XPackWatcherDeactivateWatchService{
		client: client,
	}
}

// WatchId is the ID of the watch to deactivate.
func (s *XPackWatcherDeactivateWatchService) WatchId(watchId string) *XPackWatcherDeactivateWatchService {
	s.watchId = watchId
	return s
}

// MasterTimeout specifies an explicit operation timeout for connection to master node.
func (s *XPackWatcherDeactivateWatchService) MasterTimeout(masterTimeout string) *XPackWatcherDeactivateWatchService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherDeactivateWatchService) Pretty(pretty bool) *XPackWatcherDeactivateWatchService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherDeactivateWatchService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_xpack/watcher/watch/{watch_id}/_deactivate", map[string]string{
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
func (s *XPackWatcherDeactivateWatchService) Validate() error {
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
func (s *XPackWatcherDeactivateWatchService) Do(ctx context.Context) (*XPackWatcherDeactivateWatchResponse, error) {
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
	ret := new(XPackWatcherDeactivateWatchResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherDeactivateWatchResponse is the response of XPackWatcherDeactivateWatchService.Do.
type XPackWatcherDeactivateWatchResponse struct {
	Status *XPackWatchStatus `json:"status"`
}
