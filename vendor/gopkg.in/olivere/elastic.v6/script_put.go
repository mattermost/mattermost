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

// PutScriptService adds or updates a stored script in Elasticsearch.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/modules-scripting.html
// for details.
type PutScriptService struct {
	client        *Client
	pretty        bool
	id            string
	context       string
	timeout       string
	masterTimeout string
	bodyJson      interface{}
	bodyString    string
}

// NewPutScriptService creates a new PutScriptService.
func NewPutScriptService(client *Client) *PutScriptService {
	return &PutScriptService{
		client: client,
	}
}

// Id is the script ID.
func (s *PutScriptService) Id(id string) *PutScriptService {
	s.id = id
	return s
}

// Context specifies the script context (optional).
func (s *PutScriptService) Context(context string) *PutScriptService {
	s.context = context
	return s
}

// Timeout is an explicit operation timeout.
func (s *PutScriptService) Timeout(timeout string) *PutScriptService {
	s.timeout = timeout
	return s
}

// MasterTimeout is the timeout for connecting to master.
func (s *PutScriptService) MasterTimeout(masterTimeout string) *PutScriptService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *PutScriptService) Pretty(pretty bool) *PutScriptService {
	s.pretty = pretty
	return s
}

// BodyJson is the document as a serializable JSON interface.
func (s *PutScriptService) BodyJson(body interface{}) *PutScriptService {
	s.bodyJson = body
	return s
}

// BodyString is the document encoded as a string.
func (s *PutScriptService) BodyString(body string) *PutScriptService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *PutScriptService) buildURL() (string, string, url.Values, error) {
	var (
		err    error
		method = "PUT"
		path   string
	)

	if s.context != "" {
		path, err = uritemplates.Expand("/_scripts/{id}/{context}", map[string]string{
			"id":      s.id,
			"context": s.context,
		})
	} else {
		path, err = uritemplates.Expand("/_scripts/{id}", map[string]string{
			"id": s.id,
		})
	}
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
func (s *PutScriptService) Validate() error {
	var invalid []string
	if s.id == "" {
		invalid = append(invalid, "Id")
	}
	if s.bodyString == "" && s.bodyJson == nil {
		invalid = append(invalid, "BodyJson")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *PutScriptService) Do(ctx context.Context) (*PutScriptResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	method, path, params, err := s.buildURL()
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
		Method: method,
		Path:   path,
		Params: params,
		Body:   body,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(PutScriptResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// PutScriptResponse is the result of saving a stored script
// in Elasticsearch.
type PutScriptResponse struct {
	AcknowledgedResponse
}
