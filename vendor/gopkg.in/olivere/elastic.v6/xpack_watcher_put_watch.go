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

// XPackWatcherPutWatchService either registers a new watch in Watcher
// or update an existing one.
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/watcher-api-put-watch.html.
type XPackWatcherPutWatchService struct {
	client        *Client
	pretty        bool
	id            string
	active        *bool
	masterTimeout string
	ifSeqNo       *int64
	ifPrimaryTerm *int64
	body          interface{}
}

// NewXPackWatcherPutWatchService creates a new XPackWatcherPutWatchService.
func NewXPackWatcherPutWatchService(client *Client) *XPackWatcherPutWatchService {
	return &XPackWatcherPutWatchService{
		client: client,
	}
}

// Id of the watch to upsert.
func (s *XPackWatcherPutWatchService) Id(id string) *XPackWatcherPutWatchService {
	s.id = id
	return s
}

// Active specifies whether the watch is in/active by default.
func (s *XPackWatcherPutWatchService) Active(active bool) *XPackWatcherPutWatchService {
	s.active = &active
	return s
}

// MasterTimeout is an explicit operation timeout for connection to master node.
func (s *XPackWatcherPutWatchService) MasterTimeout(masterTimeout string) *XPackWatcherPutWatchService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *XPackWatcherPutWatchService) Pretty(pretty bool) *XPackWatcherPutWatchService {
	s.pretty = pretty
	return s
}

// IfSeqNo indicates to update the watch only if the last operation that
// has changed the watch has the specified sequence number.
func (s *XPackWatcherPutWatchService) IfSeqNo(seqNo int64) *XPackWatcherPutWatchService {
	s.ifSeqNo = &seqNo
	return s
}

// IfPrimaryTerm indicates to update the watch only if the last operation that
// has changed the watch has the specified primary term.
func (s *XPackWatcherPutWatchService) IfPrimaryTerm(primaryTerm int64) *XPackWatcherPutWatchService {
	s.ifPrimaryTerm = &primaryTerm
	return s
}

// Body specifies the watch. Use a string or a type that will get serialized as JSON.
func (s *XPackWatcherPutWatchService) Body(body interface{}) *XPackWatcherPutWatchService {
	s.body = body
	return s
}

// buildURL builds the URL for the operation.
func (s *XPackWatcherPutWatchService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_xpack/watcher/watch/{id}", map[string]string{
		"id": s.id,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	if s.active != nil {
		params.Set("active", fmt.Sprintf("%v", *s.active))
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	if v := s.ifSeqNo; v != nil {
		params.Set("if_seq_no", fmt.Sprintf("%d", *v))
	}
	if v := s.ifPrimaryTerm; v != nil {
		params.Set("if_primary_term", fmt.Sprintf("%d", *v))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *XPackWatcherPutWatchService) Validate() error {
	var invalid []string
	if s.id == "" {
		invalid = append(invalid, "Id")
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
func (s *XPackWatcherPutWatchService) Do(ctx context.Context) (*XPackWatcherPutWatchResponse, error) {
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
	ret := new(XPackWatcherPutWatchResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// XPackWatcherPutWatchResponse is the response of XPackWatcherPutWatchService.Do.
type XPackWatcherPutWatchResponse struct {
}
