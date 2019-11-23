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

// XPackSecurityDeleteRoleService delete a role by its name.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/security-api-delete-role.html.
type XPackSecurityDeleteRoleService struct {
	client *Client
	pretty bool
	name   string
}

// NewXPackSecurityDeleteRoleService creates a new XPackSecurityDeleteRoleService.
func NewXPackSecurityDeleteRoleService(client *Client) *XPackSecurityDeleteRoleService {
	return &XPackSecurityDeleteRoleService{
		client: client,
	}
}

// Name is name of the role to delete.
func (s *XPackSecurityDeleteRoleService) Name(name string) *XPackSecurityDeleteRoleService {
	s.name = name
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackSecurityDeleteRoleService) Pretty(pretty bool) *XPackSecurityDeleteRoleService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackSecurityDeleteRoleService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_xpack/security/role/{name}", map[string]string{
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
func (s *XPackSecurityDeleteRoleService) Validate() error {
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
func (s *XPackSecurityDeleteRoleService) Do(ctx context.Context) (*XPackSecurityDeleteRoleResponse, error) {
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
	ret := new(XPackSecurityDeleteRoleResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackSecurityDeleteRoleResponse is the response of XPackSecurityDeleteRoleService.Do.
type XPackSecurityDeleteRoleResponse struct {
	Found bool `json:"found"`
}
