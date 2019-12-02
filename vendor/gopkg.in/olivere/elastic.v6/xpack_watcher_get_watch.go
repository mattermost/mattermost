// Copyright 2012-2018 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/olivere/elastic/uritemplates"
)

// XPackWatcherGetWatchService retrieves a watch by its ID.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-get-watch.html.
type XPackWatcherGetWatchService struct {
	client *Client
	pretty bool
	id     string
}

// NewXPackWatcherGetWatchService creates a new XPackWatcherGetWatchService.
func NewXPackWatcherGetWatchService(client *Client) *XPackWatcherGetWatchService {
	return &XPackWatcherGetWatchService{
		client: client,
	}
}

// Id is ID of the watch to retrieve.
func (s *XPackWatcherGetWatchService) Id(id string) *XPackWatcherGetWatchService {
	s.id = id
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherGetWatchService) Pretty(pretty bool) *XPackWatcherGetWatchService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherGetWatchService) buildURL() (string, url.Values, error) {
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
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherGetWatchService) Validate() error {
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
func (s *XPackWatcherGetWatchService) Do(ctx context.Context) (*XPackWatcherGetWatchResponse, error) {
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
	ret := new(XPackWatcherGetWatchResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherGetWatchResponse is the response of XPackWatcherGetWatchService.Do.
type XPackWatcherGetWatchResponse struct {
	Found   bool              `json:"found"`
	Id      string            `json:"_id"`
	Version int64             `json:"_version,omitempty"`
	Status  *XPackWatchStatus `json:"status,omitempty"`
	Watch   *XPackWatch       `json:"watch,omitempty"`
}

type XPackWatchStatus struct {
	State            *XPackWatchExecutionState          `json:"state,omitempty"`
	LastChecked      *time.Time                         `json:"last_checked,omitempty"`
	LastMetCondition *time.Time                         `json:"last_met_condition,omitempty"`
	Actions          map[string]*XPackWatchActionStatus `json:"actions,omitempty"`
	ExecutionState   *XPackWatchActionExecutionState    `json:"execution_state,omitempty"`
	Headers          map[string]string                  `json:"headers,omitempty"`
	Version          int64                              `json:"version"`
}

type XPackWatchExecutionState struct {
	Active    bool      `json:"active"`
	Timestamp time.Time `json:"timestamp"`
}

type XPackWatchActionStatus struct {
	AckStatus               *XPackWatchActionAckStatus `json:"ack"`
	LastExecution           *time.Time                 `json:"last_execution,omitempty"`
	LastSuccessfulExecution *time.Time                 `json:"last_successful_execution,omitempty"`
	LastThrottle            *XPackWatchActionThrottle  `json:"last_throttle,omitempty"`
}

type XPackWatchActionAckStatus struct {
	Timestamp      time.Time `json:"timestamp"`
	AckStatusState string    `json:"ack_status_state"`
}

type XPackWatchActionExecutionState struct {
	Timestamp  time.Time `json:"timestamp"`
	Successful bool      `json:"successful"`
	Reason     string    `json:"reason,omitempty"`
}

type XPackWatchActionThrottle struct {
	Timestamp time.Time `json:"timestamp"`
	Reason    string    `json:"reason,omitempty"`
}

type XPackWatch struct {
	Trigger                map[string]map[string]interface{}  `json:"trigger"`
	Input                  map[string]map[string]interface{}  `json:"input"`
	Condition              map[string]map[string]interface{}  `json:"condition"`
	Transform              map[string]interface{}             `json:"transform,omitempty"`
	ThrottlePeriod         string                             `json:"throttle_period,omitempty"`
	ThrottlePeriodInMillis int64                              `json:"throttle_period_in_millis,omitempty"`
	Actions                map[string]*XPackWatchActionStatus `json:"actions"`
	Metadata               map[string]interface{}             `json:"metadata,omitempty"`
	Status                 *XPackWatchStatus                  `json:"status,omitempty"`
}
