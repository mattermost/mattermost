// Copyright 2012-present Oliver Eilhard. All rights reserved.
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

// GetScriptService reads a stored script in Elasticsearch.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/modules-scripting.html
// for details.
type GetScriptService struct {
	client *Client
	pretty bool
	id     string
}

// NewGetScriptService creates a new GetScriptService.
func NewGetScriptService(client *Client) *GetScriptService {
	return &GetScriptService{
		client: client,
	}
}

// Id is the script ID.
func (s *GetScriptService) Id(id string) *GetScriptService {
	s.id = id
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *GetScriptService) Pretty(pretty bool) *GetScriptService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *GetScriptService) buildURL() (string, string, url.Values, error) {
	var (
		err    error
		method = "GET"
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
	return method, path, params, nil
}

// Validate checks if the operation is valid.
func (s *GetScriptService) Validate() error {
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
func (s *GetScriptService) Do(ctx context.Context) (*GetScriptResponse, error) {
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
	ret := new(GetScriptResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// GetScriptResponse is the result of getting a stored script
// from Elasticsearch.
type GetScriptResponse struct {
	Id     string          `json:"_id"`
	Found  bool            `json:"found"`
	Script json.RawMessage `json:"script"`
}
