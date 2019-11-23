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

// XPackWatcherDeleteWatchService removes a watch.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-delete-watch.html.
type XPackWatcherDeleteWatchService struct {
	client        *Client
	pretty        bool
	id            string
	masterTimeout string
}

// NewXPackWatcherDeleteWatchService creates a new XPackWatcherDeleteWatchService.
func NewXPackWatcherDeleteWatchService(client *Client) *XPackWatcherDeleteWatchService {
	return &XPackWatcherDeleteWatchService{
		client: client,
	}
}

// Id of the watch to delete.
func (s *XPackWatcherDeleteWatchService) Id(id string) *XPackWatcherDeleteWatchService {
	s.id = id
	return s
}

// MasterTimeout specifies an explicit operation timeout for connection to master node.
func (s *XPackWatcherDeleteWatchService) MasterTimeout(masterTimeout string) *XPackWatcherDeleteWatchService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherDeleteWatchService) Pretty(pretty bool) *XPackWatcherDeleteWatchService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherDeleteWatchService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_xpack/watcher/watch/{id}", map[string]string{
		"id": s.id,
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
func (s *XPackWatcherDeleteWatchService) Validate() error {
	var invalid []string
	if s.id == "" {
		invalid = append(invalid, "Id")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *XPackWatcherDeleteWatchService) Do(ctx context.Context) (*XPackWatcherDeleteWatchResponse, error) {
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
		Method: "DELETE",
		Path:   path,
		Params: params,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(XPackWatcherDeleteWatchResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherDeleteWatchResponse is the response of XPackWatcherDeleteWatchService.Do.
type XPackWatcherDeleteWatchResponse struct {
	Found   bool   `json:"found"`
	Id      string `json:"_id"`
	Version int    `json:"_version"`
}
