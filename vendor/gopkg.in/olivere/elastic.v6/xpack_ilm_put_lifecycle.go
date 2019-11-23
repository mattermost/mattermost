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

// See the documentation at
// https://www.elastic.co/guide/en/elasticsearch/reference/6.8/ilm-put-lifecycle.html
type XPackIlmPutLifecycleService struct {
	client        *Client
	policy        string
	pretty        bool
	timeout       string
	masterTimeout string
	flatSettings  *bool
	bodyJson      interface{}
	bodyString    string
}

// NewXPackIlmPutLifecycleService creates a new XPackIlmPutLifecycleService.
func NewXPackIlmPutLifecycleService(client *Client) *XPackIlmPutLifecycleService {
	return &XPackIlmPutLifecycleService{
		client: client,
	}
}

// Policy is the name of the index lifecycle policy.
func (s *XPackIlmPutLifecycleService) Policy(policy string) *XPackIlmPutLifecycleService {
	s.policy = policy
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackIlmPutLifecycleService) Pretty(pretty bool) *XPackIlmPutLifecycleService {
	s.pretty = pretty
	return s
}

// Timeout is an explicit operation timeout.
func (s *XPackIlmPutLifecycleService) Timeout(timeout string) *XPackIlmPutLifecycleService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *XPackIlmPutLifecycleService) MasterTimeout(masterTimeout string) *XPackIlmPutLifecycleService {
	s.masterTimeout = masterTimeout
	return s
}

// FlatSettings indicates whether to return settings in flat format (default: false).
func (s *XPackIlmPutLifecycleService) FlatSettings(flatSettings bool) *XPackIlmPutLifecycleService {
	s.flatSettings = &flatSettings
	return s
}

// BodyJson is documented as: The template definition.
func (s *XPackIlmPutLifecycleService) BodyJson(body interface{}) *XPackIlmPutLifecycleService {
	s.bodyJson = body
	return s
}

// BodyString is documented as: The template definition.
func (s *XPackIlmPutLifecycleService) BodyString(body string) *XPackIlmPutLifecycleService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackIlmPutLifecycleService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_ilm/policy/{policy}", map[string]string{
		"policy": s.policy,
	})
	if err != nil {
		return "", url.Values{}, err
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
		params.Set("master_timeout", s.masterTimeout)
	}
	if s.flatSettings != nil {
		params.Set("flat_settings", fmt.Sprintf("%v", *s.flatSettings))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackIlmPutLifecycleService) Validate() error {
	var invalid []string
	if s.policy == "" {
		invalid = append(invalid, "Policy")
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
func (s *XPackIlmPutLifecycleService) Do(ctx context.Context) (*XPackIlmPutLifecycleResponse, error) {
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
	ret := new(XPackIlmPutLifecycleResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackIlmPutLifecycleSResponse is the response of XPackIlmPutLifecycleService.Do.
type XPackIlmPutLifecycleResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
