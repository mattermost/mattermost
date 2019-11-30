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

// XPackWatcherExecuteWatchService forces the execution of a stored watch.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-execute-watch.html.
type XPackWatcherExecuteWatchService struct {
	client     *Client
	pretty     bool
	id         string
	debug      *bool
	bodyJson   interface{}
	bodyString string
}

// NewXPackWatcherExecuteWatchService creates a new XPackWatcherExecuteWatchService.
func NewXPackWatcherExecuteWatchService(client *Client) *XPackWatcherExecuteWatchService {
	return &XPackWatcherExecuteWatchService{
		client: client,
	}
}

// Id of the watch to execute on.
func (s *XPackWatcherExecuteWatchService) Id(id string) *XPackWatcherExecuteWatchService {
	s.id = id
	return s
}

// Debug indicates whether the watch should execute in debug mode.
func (s *XPackWatcherExecuteWatchService) Debug(debug bool) *XPackWatcherExecuteWatchService {
	s.debug = &debug
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherExecuteWatchService) Pretty(pretty bool) *XPackWatcherExecuteWatchService {
	s.pretty = pretty
	return s
}

// BodyJson is documented as: Execution control.
func (s *XPackWatcherExecuteWatchService) BodyJson(body interface{}) *XPackWatcherExecuteWatchService {
	s.bodyJson = body
	return s
}

// BodyString is documented as: Execution control.
func (s *XPackWatcherExecuteWatchService) BodyString(body string) *XPackWatcherExecuteWatchService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherExecuteWatchService) buildURL() (string, url.Values, error) {
	// Build URL
	var (
		path string
		err  error
	)
	if s.id != "" {
		path, err = uritemplates.Expand("/_xpack/watcher/watch/{id}/_execute", map[string]string{
			"id": s.id,
		})
	} else {
		path = "/_xpack/watcher/watch/_execute"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	if s.debug != nil {
		params.Set("debug", fmt.Sprintf("%v", *s.debug))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherExecuteWatchService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *XPackWatcherExecuteWatchService) Do(ctx context.Context) (*XPackWatcherExecuteWatchResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Setup HTTP request body
	var body interface{}
	if s.bodyJson != nil {
		body = s.bodyJson
	} else {
		body = s.bodyString
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, PerformRequestOptions{
		Method: "PUT",
		Path:   path,
		Params: params,
		Body:   body,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(XPackWatcherExecuteWatchResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherExecuteWatchResponse is the response of XPackWatcherExecuteWatchService.Do.
type XPackWatcherExecuteWatchResponse struct {
	Id          string            `json:"_id"`
	WatchRecord *XPackWatchRecord `json:"watch_record"`
}

type XPackWatchRecord struct {
	WatchId   string                            `json:"watch_id"`
	Node      string                            `json:"node"`
	Messages  []string                          `json:"messages"`
	State     string                            `json:"state"`
	Status    *XPackWatchRecordStatus           `json:"status"`
	Input     map[string]map[string]interface{} `json:"input"`
	Condition map[string]map[string]interface{} `json:"condition"`
	Result    map[string]interface{}            `json:"Result"`
}

type XPackWatchRecordStatus struct {
	Version          int                               `json:"version"`
	State            map[string]interface{}            `json:"state"`
	LastChecked      string                            `json:"last_checked"`
	LastMetCondition string                            `json:"last_met_condition"`
	Actions          map[string]map[string]interface{} `json:"actions"`
	ExecutionState   string                            `json:"execution_state"`
}
