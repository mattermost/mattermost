// Copyright 2012-2018 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// XPackWatcherRestartService stops the starts the watcher service.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-restart.html.
type XPackWatcherRestartService struct {
	client *Client

	pretty     *bool       // pretty format the returned JSON response
	human      *bool       // return human readable values for statistics
	errorTrace *bool       // include the stack trace of returned errors
	filterPath []string    // list of filters used to reduce the response
	headers    http.Header // custom request-level HTTP headers
}

// NewXPackWatcherRestartService creates a new XPackWatcherRestartService.
func NewXPackWatcherRestartService(client *Client) *XPackWatcherRestartService {
	return &XPackWatcherRestartService{
		client: client,
	}
}

// Pretty tells Elasticsearch whether to return a formatted JSON response.
func (s *XPackWatcherRestartService) Pretty(pretty bool) *XPackWatcherRestartService {
	s.pretty = &pretty
	return s
}

// Human specifies whether human readable values should be returned in
// the JSON response, e.g. "7.5mb".
func (s *XPackWatcherRestartService) Human(human bool) *XPackWatcherRestartService {
	s.human = &human
	return s
}

// ErrorTrace specifies whether to include the stack trace of returned errors.
func (s *XPackWatcherRestartService) ErrorTrace(errorTrace bool) *XPackWatcherRestartService {
	s.errorTrace = &errorTrace
	return s
}

// FilterPath specifies a list of filters used to reduce the response.
func (s *XPackWatcherRestartService) FilterPath(filterPath ...string) *XPackWatcherRestartService {
	s.filterPath = filterPath
	return s
}

// Header adds a header to the request.
func (s *XPackWatcherRestartService) Header(name string, value string) *XPackWatcherRestartService {
	if s.headers == nil {
		s.headers = http.Header{}
	}
	s.headers.Add(name, value)
	return s
}

// Headers specifies the headers of the request.
func (s *XPackWatcherRestartService) Headers(headers http.Header) *XPackWatcherRestartService {
	s.headers = headers
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherRestartService) buildURL() (string, url.Values, error) {
	// Build URL path
	path := "/_xpack/watcher/_restart"

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
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherRestartService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *XPackWatcherRestartService) Do(ctx context.Context) (*XPackWatcherRestartResponse, error) {
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
		Method:  "POST",
		Path:    path,
		Params:  params,
		Headers: s.headers,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(XPackWatcherRestartResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherRestartResponse is the response of XPackWatcherRestartService.Do.
type XPackWatcherRestartResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
