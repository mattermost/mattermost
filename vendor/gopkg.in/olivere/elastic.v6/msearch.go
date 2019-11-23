// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// MultiSearch executes one or more searches in one roundtrip.
type MultiSearchService struct {
	client                *Client
	requests              []*SearchRequest
	indices               []string
	pretty                bool
	maxConcurrentRequests *int
	preFilterShardSize    *int
	restTotalHitsAsInt    *bool
}

func NewMultiSearchService(client *Client) *MultiSearchService {
	builder := &MultiSearchService{
		client: client,
	}
	return builder
}

func (s *MultiSearchService) Add(requests ...*SearchRequest) *MultiSearchService {
	s.requests = append(s.requests, requests...)
	return s
}

func (s *MultiSearchService) Index(indices ...string) *MultiSearchService {
	s.indices = append(s.indices, indices...)
	return s
}

func (s *MultiSearchService) Pretty(pretty bool) *MultiSearchService {
	s.pretty = pretty
	return s
}

func (s *MultiSearchService) MaxConcurrentSearches(max int) *MultiSearchService {
	s.maxConcurrentRequests = &max
	return s
}

func (s *MultiSearchService) PreFilterShardSize(size int) *MultiSearchService {
	s.preFilterShardSize = &size
	return s
}

// RestTotalHitsAsInt is a flag that is temporarily available for ES 7.x
// servers to return total hits as an int64 instead of a response structure.
//
// Warning: Using it indicates that you are using elastic.v6 with ES 7.x,
// which is an unsupported scenario. Use at your own risk.
// This option will also be removed with ES 8.x.
// See https://www.elastic.co/guide/en/elasticsearch/reference/7.0/breaking-changes-7.0.html#hits-total-now-object-search-response.
func (s *MultiSearchService) RestTotalHitsAsInt(v bool) *MultiSearchService {
	s.restTotalHitsAsInt = &v
	return s
}

func (s *MultiSearchService) Do(ctx context.Context) (*MultiSearchResult, error) {
	// Build url
	path := "/_msearch"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprint(s.pretty))
	}
	if v := s.maxConcurrentRequests; v != nil {
		params.Set("max_concurrent_searches", fmt.Sprint(*v))
	}
	if v := s.preFilterShardSize; v != nil {
		params.Set("pre_filter_shard_size", fmt.Sprint(*v))
	}
	if v := s.restTotalHitsAsInt; v != nil {
		params.Set("rest_total_hits_as_int", fmt.Sprint(*v))
	}

	// Set body
	var lines []string
	for _, sr := range s.requests {
		// Set default indices if not specified in the request
		if !sr.HasIndices() && len(s.indices) > 0 {
			sr = sr.Index(s.indices...)
		}

		header, err := json.Marshal(sr.header())
		if err != nil {
			return nil, err
		}
		body, err := sr.Body()
		if err != nil {
			return nil, err
		}
		lines = append(lines, string(header))
		lines = append(lines, body)
	}
	body := strings.Join(lines, "\n") + "\n" // add trailing \n

	// Get response
	res, err := s.client.PerformRequest(ctx, PerformRequestOptions{
		Method: "GET",
		Path:   path,
		Params: params,
		Body:   body,
	})
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(MultiSearchResult)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// MultiSearchResult is the outcome of running a multi-search operation.
type MultiSearchResult struct {
	Responses []*SearchResult `json:"responses,omitempty"`
}
