// Copyright 2012-2018 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/olivere/elastic/uritemplates"
)

// XPackWatcherAckWatchService enables you to manually throttle execution of the watch’s actions.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-ack-watch.html.
type XPackWatcherAckWatchService struct {
	client        *Client
	pretty        bool
	watchId       string
	actionId      []string
	masterTimeout string
}

// NewXPackWatcherAckWatchService creates a new XPackWatcherAckWatchService.
func NewXPackWatcherAckWatchService(client *Client) *XPackWatcherAckWatchService {
	return &XPackWatcherAckWatchService{
		client: client,
	}
}

// WatchId is the unique ID of the watch.
func (s *XPackWatcherAckWatchService) WatchId(watchId string) *XPackWatcherAckWatchService {
	s.watchId = watchId
	return s
}

// ActionId is a slice of action ids to be acked.
func (s *XPackWatcherAckWatchService) ActionId(actionId ...string) *XPackWatcherAckWatchService {
	s.actionId = append(s.actionId, actionId...)
	return s
}

// MasterTimeout indicates an explicit operation timeout for
// connection to master node.
func (s *XPackWatcherAckWatchService) MasterTimeout(masterTimeout string) *XPackWatcherAckWatchService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherAckWatchService) Pretty(pretty bool) *XPackWatcherAckWatchService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherAckWatchService) buildURL() (string, url.Values, error) {
	// Build URL
	var (
		path string
		err  error
	)
	if len(s.actionId) > 0 {
		path, err = uritemplates.Expand("/_xpack/watcher/watch/{watch_id}/_ack/{action_id}", map[string]string{
			"watch_id":  s.watchId,
			"action_id": strings.Join(s.actionId, ","),
		})
	} else {
		path, err = uritemplates.Expand("/_xpack/watcher/watch/{watch_id}/_ack", map[string]string{
			"watch_id": s.watchId,
		})
	}
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
func (s *XPackWatcherAckWatchService) Validate() error {
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
func (s *XPackWatcherAckWatchService) Do(ctx context.Context) (*XPackWatcherAckWatchResponse, error) {
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
	ret := new(XPackWatcherAckWatchResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherAckWatchResponse is the response of XPackWatcherAckWatchService.Do.
type XPackWatcherAckWatchResponse struct {
	Status *XPackWatcherAckWatchStatus `json:"status"`
}

// XPackWatcherAckWatchStatus is the status of a XPackWatcherAckWatchResponse.
type XPackWatcherAckWatchStatus struct {
	State            map[string]interface{}            `json:"state"`
	LastChecked      string                            `json:"last_checked"`
	LastMetCondition string                            `json:"last_met_condition"`
	Actions          map[string]map[string]interface{} `json:"actions"`
	ExecutionState   string                            `json:"execution_state"`
	Version          int                               `json:"version"`
}
