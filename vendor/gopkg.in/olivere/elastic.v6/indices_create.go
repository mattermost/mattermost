// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"errors"
	"net/url"

	"github.com/olivere/elastic/uritemplates"
)

// IndicesCreateService creates a new index.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/indices-create-index.html
// for details.
type IndicesCreateService struct {
	client          *Client
	pretty          bool
	index           string
	timeout         string
	masterTimeout   string
	includeTypeName *bool
	updateAllTypes  *bool
	bodyJson        interface{}
	bodyString      string
}

// NewIndicesCreateService returns a new IndicesCreateService.
func NewIndicesCreateService(client *Client) *IndicesCreateService {
	return &IndicesCreateService{client: client}
}

// Index is the name of the index to create.
func (b *IndicesCreateService) Index(index string) *IndicesCreateService {
	b.index = index
	return b
}

// Timeout the explicit operation timeout, e.g. "5s".
func (s *IndicesCreateService) Timeout(timeout string) *IndicesCreateService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *IndicesCreateService) MasterTimeout(masterTimeout string) *IndicesCreateService {
	s.masterTimeout = masterTimeout
	return s
}

// IncludeTypeName indicates whether a type should be expected in the
// body of the mappings.
func (s *IndicesCreateService) IncludeTypeName(include bool) *IndicesCreateService {
	s.includeTypeName = &include
	return s
}

// UpdateAllTypes indicates whether to update the mapping for all fields
// with the same name across all types or not.
func (s *IndicesCreateService) UpdateAllTypes(update bool) *IndicesCreateService {
	s.updateAllTypes = &update
	return s
}

// Body specifies the configuration of the index as a string.
// It is an alias for BodyString.
func (b *IndicesCreateService) Body(body string) *IndicesCreateService {
	b.bodyString = body
	return b
}

// BodyString specifies the configuration of the index as a string.
func (b *IndicesCreateService) BodyString(body string) *IndicesCreateService {
	b.bodyString = body
	return b
}

// BodyJson specifies the configuration of the index. The interface{} will
// be serializes as a JSON document, so use a map[string]interface{}.
func (b *IndicesCreateService) BodyJson(body interface{}) *IndicesCreateService {
	b.bodyJson = body
	return b
}

// Pretty indicates that the JSON response be indented and human readable.
func (b *IndicesCreateService) Pretty(pretty bool) *IndicesCreateService {
	b.pretty = pretty
	return b
}

// Do executes the operation.
func (b *IndicesCreateService) Do(ctx context.Context) (*IndicesCreateResult, error) {
	if b.index == "" {
		return nil, errors.New("missing index name")
	}

	// Build url
	path, err := uritemplates.Expand("/{index}", map[string]string{
		"index": b.index,
	})
	if err != nil {
		return nil, err
	}

	params := make(url.Values)
	if b.pretty {
		params.Set("pretty", "true")
	}
	if b.masterTimeout != "" {
		params.Set("master_timeout", b.masterTimeout)
	}
	if b.timeout != "" {
		params.Set("timeout", b.timeout)
	}
	if v := b.includeTypeName; v != nil {
		if *v {
			params.Set("include_type_name", "true")
		} else {
			params.Set("include_type_name", "false")
		}
	}
	if v := b.updateAllTypes; v != nil && *v {
		if *v {
			params.Set("update_all_types", "true")
		} else {
			params.Set("update_all_types", "false")
		}
	}

	// Setup HTTP request body
	var body interface{}
	if b.bodyJson != nil {
		body = b.bodyJson
	} else {
		body = b.bodyString
	}

	// Get response
	res, err := b.client.PerformRequest(ctx, PerformRequestOptions{
		Method: "PUT",
		Path:   path,
		Params: params,
		Body:   body,
	})
	if err != nil {
		return nil, err
	}

	ret := new(IndicesCreateResult)
	if err := b.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a create index request.

// IndicesCreateResult is the outcome of creating a new index.
type IndicesCreateResult struct {
	Acknowledged       bool   `json:"acknowledged"`
	ShardsAcknowledged bool   `json:"shards_acknowledged"`
	Index              string `json:"index,omitempty"`
}
