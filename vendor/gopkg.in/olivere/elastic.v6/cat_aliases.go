// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/olivere/elastic/uritemplates"
)

// CatAliasesService shows information about currently configured aliases
// to indices including filter and routing infos.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/cat-aliases.html
// for details.
type CatAliasesService struct {
	client        *Client
	pretty        bool
	local         *bool
	masterTimeout string
	aliases       []string
	columns       []string
	sort          []string // list of columns for sort order
}

// NewCatAliasesService creates a new CatAliasesService.
func NewCatAliasesService(client *Client) *CatAliasesService {
	return &CatAliasesService{
		client: client,
	}
}

// Alias specifies one or more aliases to which information should be returned.
func (s *CatAliasesService) Alias(alias ...string) *CatAliasesService {
	s.aliases = alias
	return s
}

// Local indicates to return local information, i.e. do not retrieve
// the state from master node (default: false).
func (s *CatAliasesService) Local(local bool) *CatAliasesService {
	s.local = &local
	return s
}

// MasterTimeout is the explicit operation timeout for connection to master node.
func (s *CatAliasesService) MasterTimeout(masterTimeout string) *CatAliasesService {
	s.masterTimeout = masterTimeout
	return s
}

// Columns to return in the response.
// To get a list of all possible columns to return, run the following command
// in your terminal:
//
// Example:
//   curl 'http://localhost:9200/_cat/aliases?help'
//
// You can use Columns("*") to return all possible columns. That might take
// a little longer than the default set of columns.
func (s *CatAliasesService) Columns(columns ...string) *CatAliasesService {
	s.columns = columns
	return s
}

// Sort is a list of fields to sort by.
func (s *CatAliasesService) Sort(fields ...string) *CatAliasesService {
	s.sort = fields
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *CatAliasesService) Pretty(pretty bool) *CatAliasesService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *CatAliasesService) buildURL() (string, url.Values, error) {
	// Build URL
	var (
		path string
		err  error
	)

	if len(s.aliases) > 0 {
		path, err = uritemplates.Expand("/_cat/aliases/{name}", map[string]string{
			"name": strings.Join(s.aliases, ","),
		})
	} else {
		path = "/_cat/aliases"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{
		"format": []string{"json"}, // always returns as JSON
	}
	if s.pretty {
		params.Set("pretty", "true")
	}
	if v := s.local; v != nil {
		params.Set("local", fmt.Sprint(*v))
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	if len(s.sort) > 0 {
		params.Set("s", strings.Join(s.sort, ","))
	}
	if len(s.columns) > 0 {
		params.Set("h", strings.Join(s.columns, ","))
	}
	return path, params, nil
}

// Do executes the operation.
func (s *CatAliasesService) Do(ctx context.Context) (CatAliasesResponse, error) {
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
	var ret CatAliasesResponse
	if err := s.client.decoder.Decode(res.Body, &ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a get request.

// CatAliasesResponse is the outcome of CatAliasesService.Do.
type CatAliasesResponse []CatAliasesResponseRow

// CatAliasesResponseRow is a single row in a CatAliasesResponse.
// Notice that not all of these fields might be filled; that depends
// on the number of columns chose in the request (see CatAliasesService.Columns).
type CatAliasesResponseRow struct {
	// Alias name.
	Alias string `json:"alias"`
	// Index the alias points to.
	Index string `json:"index"`
	// Filter, e.g. "*" or "-".
	Filter string `json:"filter"`
	// RoutingIndex specifies the index routing (or "-").
	RoutingIndex string `json:"routing.index"`
	// RoutingSearch specifies the search routing (or "-").
	RoutingSearch string `json:"routing.search"`
}
