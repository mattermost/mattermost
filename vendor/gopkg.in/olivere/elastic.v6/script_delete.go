// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"

	"github.com/olivere/elastic/uritemplates"
)

// DeleteScriptService removes a stored script in Elasticsearch.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/modules-scripting.html
// for details.
type DeleteScriptService struct {
	client        *Client
	pretty        bool
	id            string
	timeout       string
	masterTimeout string
}

// NewDeleteScriptService creates a new DeleteScriptService.
func NewDeleteScriptService(client *Client) *DeleteScriptService {
	return &DeleteScriptService{
		client: client,
	}
}

// Id is the script ID.
func (s *DeleteScriptService) Id(id string) *DeleteScriptService {
	s.id = id
	return s
}

// Timeout is an explicit operation timeout.
func (s *DeleteScriptService) Timeout(timeout string) *DeleteScriptService {
	s.timeout = timeout
	return s
}

// MasterTimeout is the timeout for connecting to master.
func (s *DeleteScriptService) MasterTimeout(masterTimeout string) *DeleteScriptService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *DeleteScriptService) Pretty(pretty bool) *DeleteScriptService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *DeleteScriptService) buildURL() (string, string, url.Values, error) {
	var (
		err    error
		method = "DELETE"
		path   string
	)

	path, err = uritemplates.Expand("/_scripts/{id}", map[string]string{
		"id": s.id,
	})
	if err != nil {
		return "", "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.masterTimeout != "" {
		params.Set("master_timestamp", s.masterTimeout)
	}
	return method, path, params, nil
}

// Validate checks if the operation is valid.
func (s *DeleteScriptService) Validate() error {
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
func (s *DeleteScriptService) Do(ctx context.Context) (*DeleteScriptResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	method, path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, PerformRequestOptions{
		Method: method,
		Path:   path,
		Params: params,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(DeleteScriptResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// DeleteScriptResponse is the result of deleting a stored script
// in Elasticsearch.
type DeleteScriptResponse struct {
	AcknowledgedResponse
}
