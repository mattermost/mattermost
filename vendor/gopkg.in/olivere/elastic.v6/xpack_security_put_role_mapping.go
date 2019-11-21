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

// XPackSecurityPutRoleMappingService create or update a role mapping by its name.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/security-api-put-role-mapping.html.
type XPackSecurityPutRoleMappingService struct {
	client *Client
	pretty bool
	name   string
	body   interface{}
}

// NewXPackSecurityPutRoleMappingService creates a new XPackSecurityPutRoleMappingService.
func NewXPackSecurityPutRoleMappingService(client *Client) *XPackSecurityPutRoleMappingService {
	return &XPackSecurityPutRoleMappingService{
		client: client,
	}
}

// Name is name of the role mapping to create/update.
func (s *XPackSecurityPutRoleMappingService) Name(name string) *XPackSecurityPutRoleMappingService {
	s.name = name
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackSecurityPutRoleMappingService) Pretty(pretty bool) *XPackSecurityPutRoleMappingService {
	s.pretty = pretty
	return s
}

// Body specifies the role mapping. Use a string or a type that will get serialized as JSON.
func (s *XPackSecurityPutRoleMappingService) Body(body interface{}) *XPackSecurityPutRoleMappingService {
	s.body = body
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackSecurityPutRoleMappingService) buildURL() (string, url.Values, error) {
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
func (s *XPackSecurityPutRoleMappingService) Validate() error {
	var invalid []string
	if s.name == "" {
		invalid = append(invalid, "Name")
	}
	if s.body == nil {
		invalid = append(invalid, "Body")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *XPackSecurityPutRoleMappingService) Do(ctx context.Context) (*XPackSecurityPutRoleMappingResponse, error) {
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
		Method: "PUT",
		Path:   path,
		Params: params,
		Body:   s.body,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(XPackSecurityPutRoleMappingResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackSecurityPutRoleMappingResponse is the response of XPackSecurityPutRoleMappingService.Do.
type XPackSecurityPutRoleMappingResponse struct {
	Role_Mapping XPackSecurityPutRoleMapping
}

type XPackSecurityPutRoleMapping struct {
	Created bool `json:"created"`
}
