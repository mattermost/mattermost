// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/olivere/elastic/uritemplates"
)

// See the documentation at
// https://www.elastic.co/guide/en/elasticsearch/reference/6.8/ilm-get-lifecycle.html.
type XPackIlmGetLifecycleService struct {
	client        *Client
	policy        []string
	pretty        bool
	timeout       string
	masterTimeout string
	flatSettings  *bool
	local         *bool
}

// NewXPackIlmGetLifecycleService creates a new XPackIlmGetLifecycleService.
func NewXPackIlmGetLifecycleService(client *Client) *XPackIlmGetLifecycleService {
	return &XPackIlmGetLifecycleService{
		client: client,
	}
}

// Policy is the name of the index lifecycle policy.
func (s *XPackIlmGetLifecycleService) Policy(policies ...string) *XPackIlmGetLifecycleService {
	s.policy = append(s.policy, policies...)
	return s
}

// Timeout is an explicit operation timeout.
func (s *XPackIlmGetLifecycleService) Timeout(timeout string) *XPackIlmGetLifecycleService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *XPackIlmGetLifecycleService) MasterTimeout(masterTimeout string) *XPackIlmGetLifecycleService {
	s.masterTimeout = masterTimeout
	return s
}

// FlatSettings is returns settings in flat format (default: false).
func (s *XPackIlmGetLifecycleService) FlatSettings(flatSettings bool) *XPackIlmGetLifecycleService {
	s.flatSettings = &flatSettings
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackIlmGetLifecycleService) Pretty(pretty bool) *XPackIlmGetLifecycleService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackIlmGetLifecycleService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if len(s.policy) > 0 {
		path, err = uritemplates.Expand("/_ilm/policy/{policy}", map[string]string{
			"policy": strings.Join(s.policy, ","),
		})
	} else {
		path = "/_ilm/policy"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	if s.flatSettings != nil {
		params.Set("flat_settings", fmt.Sprintf("%v", *s.flatSettings))
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	if s.local != nil {
		params.Set("local", fmt.Sprintf("%v", *s.local))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackIlmGetLifecycleService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *XPackIlmGetLifecycleService) Do(ctx context.Context) (map[string]*XPackIlmGetLifecycleResponse, error) {
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
	var ret map[string]*XPackIlmGetLifecycleResponse
	if err := s.client.decoder.Decode(res.Body, &ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackIlmGetLifecycleResponse is the response of XPackIlmGetLifecycleService.Do.
type XPackIlmGetLifecycleResponse struct {
	Version      int                    `json:"version,omitempty"`
	ModifiedDate int                    `json:"modified,omitempty"`
	Policy       map[string]interface{} `json:"policy,omitempty"`
}
