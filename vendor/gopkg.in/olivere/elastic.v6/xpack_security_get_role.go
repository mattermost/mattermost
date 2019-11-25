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

// XPackSecurityGetRoleService retrieves a role by its name.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/security-api-get-role.html.
type XPackSecurityGetRoleService struct {
	client *Client
	pretty bool
	name   string
}

// NewXPackSecurityGetRoleService creates a new XPackSecurityGetRoleService.
func NewXPackSecurityGetRoleService(client *Client) *XPackSecurityGetRoleService {
	return &XPackSecurityGetRoleService{
		client: client,
	}
}

// Name is name of the role to retrieve.
func (s *XPackSecurityGetRoleService) Name(name string) *XPackSecurityGetRoleService {
	s.name = name
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackSecurityGetRoleService) Pretty(pretty bool) *XPackSecurityGetRoleService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackSecurityGetRoleService) buildURL() (string, url.Values, error) {
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
func (s *XPackSecurityGetRoleService) Validate() error {
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
func (s *XPackSecurityGetRoleService) Do(ctx context.Context) (*XPackSecurityGetRoleResponse, error) {
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
	ret := XPackSecurityGetRoleResponse{}
	if err := json.Unmarshal(res.Body, &ret); err != nil {
		return nil, err
	}
	return &ret, nil
}

// XPackSecurityGetRoleResponse is the response of XPackSecurityGetRoleService.Do.
type XPackSecurityGetRoleResponse map[string]XPackSecurityRole

// XPackSecurityRole is the role object.
//
// The Java source for this struct is defined here:
// https://github.com/elastic/elasticsearch/blob/6.7/x-pack/plugin/core/src/main/java/org/elasticsearch/xpack/core/security/authz/RoleDescriptor.java
type XPackSecurityRole struct {
	Cluster           []string                             `json:"cluster"`
	Indices           []XPackSecurityIndicesPermissions    `json:"indices"`
	Applications      []XPackSecurityApplicationPrivileges `json:"applications"`
	RunAs             []string                             `json:"run_as"`
	Global            map[string]interface{}               `json:"global"`
	Metadata          map[string]interface{}               `json:"metadata"`
	TransientMetadata map[string]interface{}               `json:"transient_metadata"`
}

// XPackSecurityApplicationPrivileges is the application privileges object
type XPackSecurityApplicationPrivileges struct {
	Application string   `json:"application"`
	Privileges  []string `json:"privileges"`
	Ressources  []string `json:"resources"`
}

// XPackSecurityIndicesPermissions is the indices permission object
type XPackSecurityIndicesPermissions struct {
	Names         []string    `json:"names"`
	Privileges    []string    `json:"privileges"`
	FieldSecurity interface{} `json:"field_security"`
	Query         string      `json:"query"`
}
