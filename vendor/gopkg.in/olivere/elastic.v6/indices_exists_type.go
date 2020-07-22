// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/olivere/elastic/uritemplates"
)

// IndicesExistsTypeService checks if one or more types exist in one or more indices.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/indices-types-exists.html
// for details.
type IndicesExistsTypeService struct {
	client *Client

	pretty     *bool       // pretty format the returned JSON response
	human      *bool       // return human readable values for statistics
	errorTrace *bool       // include the stack trace of returned errors
	filterPath []string    // list of filters used to reduce the response
	headers    http.Header // custom request-level HTTP headers

	typ               []string
	index             []string
	expandWildcards   string
	local             *bool
	ignoreUnavailable *bool
	allowNoIndices    *bool
	includeTypeName   *bool
}

// NewIndicesExistsTypeService creates a new IndicesExistsTypeService.
func NewIndicesExistsTypeService(client *Client) *IndicesExistsTypeService {
	return &IndicesExistsTypeService{
		client: client,
	}
}

// Pretty tells Elasticsearch whether to return a formatted JSON response.
func (s *IndicesExistsTypeService) Pretty(pretty bool) *IndicesExistsTypeService {
	s.pretty = &pretty
	return s
}

// Human specifies whether human readable values should be returned in
// the JSON response, e.g. "7.5mb".
func (s *IndicesExistsTypeService) Human(human bool) *IndicesExistsTypeService {
	s.human = &human
	return s
}

// ErrorTrace specifies whether to include the stack trace of returned errors.
func (s *IndicesExistsTypeService) ErrorTrace(errorTrace bool) *IndicesExistsTypeService {
	s.errorTrace = &errorTrace
	return s
}

// FilterPath specifies a list of filters used to reduce the response.
func (s *IndicesExistsTypeService) FilterPath(filterPath ...string) *IndicesExistsTypeService {
	s.filterPath = filterPath
	return s
}

// Header adds a header to the request.
func (s *IndicesExistsTypeService) Header(name string, value string) *IndicesExistsTypeService {
	if s.headers == nil {
		s.headers = http.Header{}
	}
	s.headers.Add(name, value)
	return s
}

// Headers specifies the headers of the request.
func (s *IndicesExistsTypeService) Headers(headers http.Header) *IndicesExistsTypeService {
	s.headers = headers
	return s
}

// Index is a list of index names; use `_all` to check the types across all indices.
func (s *IndicesExistsTypeService) Index(indices ...string) *IndicesExistsTypeService {
	s.index = append(s.index, indices...)
	return s
}

// Type is a list of document types to check.
func (s *IndicesExistsTypeService) Type(types ...string) *IndicesExistsTypeService {
	s.typ = append(s.typ, types...)
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *IndicesExistsTypeService) IgnoreUnavailable(ignoreUnavailable bool) *IndicesExistsTypeService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// (This includes `_all` string or when no indices have been specified).
func (s *IndicesExistsTypeService) AllowNoIndices(allowNoIndices bool) *IndicesExistsTypeService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *IndicesExistsTypeService) ExpandWildcards(expandWildcards string) *IndicesExistsTypeService {
	s.expandWildcards = expandWildcards
	return s
}

// Local specifies whether to return local information, i.e. do not retrieve
// the state from master node (default: false).
func (s *IndicesExistsTypeService) Local(local bool) *IndicesExistsTypeService {
	s.local = &local
	return s
}

// IncludeTypeName indicates whether a type should be expected in the
// body of the mappings.
func (s *IndicesExistsTypeService) IncludeTypeName(include bool) *IndicesExistsTypeService {
	s.includeTypeName = &include
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesExistsTypeService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}/_mapping/{type}", map[string]string{
		"index": strings.Join(s.index, ","),
		"type":  strings.Join(s.typ, ","),
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if v := s.pretty; v != nil {
		params.Set("pretty", fmt.Sprint(*v))
	}
	if v := s.human; v != nil {
		params.Set("human", fmt.Sprint(*v))
	}
	if v := s.errorTrace; v != nil {
		params.Set("error_trace", fmt.Sprint(*v))
	}
	if len(s.filterPath) > 0 {
		params.Set("filter_path", strings.Join(s.filterPath, ","))
	}
	if v := s.ignoreUnavailable; v != nil {
		params.Set("ignore_unavailable", fmt.Sprint(*v))
	}
	if v := s.allowNoIndices; v != nil {
		params.Set("allow_no_indices", fmt.Sprint(*v))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if v := s.local; v != nil {
		params.Set("local", fmt.Sprint(*v))
	}
	if v := s.includeTypeName; v != nil {
		params.Set("include_type_name", fmt.Sprint(*v))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesExistsTypeService) Validate() error {
	var invalid []string
	if len(s.index) == 0 {
		invalid = append(invalid, "Index")
	}
	if len(s.typ) == 0 {
		invalid = append(invalid, "Type")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IndicesExistsTypeService) Do(ctx context.Context) (bool, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return false, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return false, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, PerformRequestOptions{
		Method:       "HEAD",
		Path:         path,
		Params:       params,
		IgnoreErrors: []int{http.StatusNotFound},
		Headers:      s.headers,
	})
	if err != nil {
		return false, err
	}

	// Return operation response
	switch res.StatusCode {
	case http.StatusOK:
		return true, nil
	case http.StatusNotFound:
		return false, nil
	default:
		return false, fmt.Errorf("elastic: got HTTP code %d when it should have been either 200 or 404", res.StatusCode)
	}
}
