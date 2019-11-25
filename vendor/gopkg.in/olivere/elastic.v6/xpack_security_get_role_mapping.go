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

// XPackSecurityGetRoleMappingService retrieves a role mapping by its name.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/security-api-get-role-mapping.html.
type XPackSecurityGetRoleMappingService struct {
	client *Client
	pretty bool
	name   string
}

// NewXPackSecurityGetRoleMappingService creates a new XPackSecurityGetRoleMappingService.
func NewXPackSecurityGetRoleMappingService(client *Client) *XPackSecurityGetRoleMappingService {
	return &XPackSecurityGetRoleMappingService{
		client: client,
	}
}

// Name is name of the role mapping to retrieve.
func (s *XPackSecurityGetRoleMappingService) Name(name string) *XPackSecurityGetRoleMappingService {
	s.name = name
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackSecurityGetRoleMappingService) Pretty(pretty bool) *XPackSecurityGetRoleMappingService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackSecurityGetRoleMappingService) buildURL() (string, url.Values, error) {
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
func (s *XPackSecurityGetRoleMappingService) Validate() error {
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
func (s *XPackSecurityGetRoleMappingService) Do(ctx context.Context) (*XPackSecurityGetRoleMappingResponse, error) {
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
	ret := XPackSecurityGetRoleMappingResponse{}
	if err := json.Unmarshal(res.Body, &ret); err != nil {
		return nil, err
	}
	return &ret, nil
}

// XPackSecurityGetRoleMappingResponse is the response of XPackSecurityGetRoleMappingService.Do.
type XPackSecurityGetRoleMappingResponse map[string]XPackSecurityRoleMapping

// XPackSecurityRoleMapping is the role mapping object
type XPackSecurityRoleMapping struct {
	Enabled  bool                   `json:"enabled"`
	Roles    []string               `json:"roles"`
	Rules    map[string]interface{} `json:"rules"`
	Metadata interface{}            `json:"metadata"`
}
