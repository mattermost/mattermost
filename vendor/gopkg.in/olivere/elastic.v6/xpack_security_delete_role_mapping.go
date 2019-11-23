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

// XPackSecurityDeleteRoleMappingService delete a role mapping by its name.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/security-api-delete-role-mapping.html.
type XPackSecurityDeleteRoleMappingService struct {
	client *Client
	pretty bool
	name   string
}

// NewXPackSecurityDeleteRoleMappingService creates a new XPackSecurityDeleteRoleMappingService.
func NewXPackSecurityDeleteRoleMappingService(client *Client) *XPackSecurityDeleteRoleMappingService {
	return &XPackSecurityDeleteRoleMappingService{
		client: client,
	}
}

// Name is name of the role mapping to delete.
func (s *XPackSecurityDeleteRoleMappingService) Name(name string) *XPackSecurityDeleteRoleMappingService {
	s.name = name
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackSecurityDeleteRoleMappingService) Pretty(pretty bool) *XPackSecurityDeleteRoleMappingService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackSecurityDeleteRoleMappingService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_xpack/security/role_mapping/{name}", map[string]string{
		"name": s.name,
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
func (s *XPackSecurityDeleteRoleMappingService) Validate() error {
	var invalid []string
	if s.name == "" {
		invalid = append(invalid, "Name")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *XPackSecurityDeleteRoleMappingService) Do(ctx context.Context) (*XPackSecurityDeleteRoleMappingResponse, error) {
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
	ret := new(XPackSecurityDeleteRoleMappingResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackSecurityDeleteRoleMappingResponse is the response of XPackSecurityDeleteRoleMappingService.Do.
type XPackSecurityDeleteRoleMappingResponse struct {
	Found bool `json:"found"`
}
