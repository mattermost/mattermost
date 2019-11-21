// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
	"strings"
)

// CatHealthService returns a terse representation of the same information
// as /_cluster/health.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.8/cat-health.html
// for details.
type CatHealthService struct {
	client              *Client
	pretty              bool
	local               *bool
	masterTimeout       string
	columns             []string
	sort                []string // list of columns for sort order
	disableTimestamping *bool
}

// NewCatHealthService creates a new CatHealthService.
func NewCatHealthService(client *Client) *CatHealthService {
	return &CatHealthService{
		client: client,
	}
}

// Local indicates to return local information, i.e. do not retrieve
// the state from master node (default: false).
func (s *CatHealthService) Local(local bool) *CatHealthService {
	s.local = &local
	return s
}

// MasterTimeout is the explicit operation timeout for connection to master node.
func (s *CatHealthService) MasterTimeout(masterTimeout string) *CatHealthService {
	s.masterTimeout = masterTimeout
	return s
}

// Columns to return in the response.
// To get a list of all possible columns to return, run the following command
// in your terminal:
//
// Example:
//   curl 'http://localhost:9200/_cat/indices?help'
//
// You can use Columns("*") to return all possible columns. That might take
// a little longer than the default set of columns.
func (s *CatHealthService) Columns(columns ...string) *CatHealthService {
	s.columns = columns
	return s
}

// Sort is a list of fields to sort by.
func (s *CatHealthService) Sort(fields ...string) *CatHealthService {
	s.sort = fields
	return s
}

// DisableTimestamping disables timestamping (default: true).
func (s *CatHealthService) DisableTimestamping(disable bool) *CatHealthService {
	s.disableTimestamping = &disable
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *CatHealthService) Pretty(pretty bool) *CatHealthService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *CatHealthService) buildURL() (string, url.Values, error) {
	// Build URL
	path := "/_cat/health"

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
	if v := s.disableTimestamping; v != nil {
		params.Set("ts", fmt.Sprint(*v))
	}
	if len(s.columns) > 0 {
		params.Set("h", strings.Join(s.columns, ","))
	}
	return path, params, nil
}

// Do executes the operation.
func (s *CatHealthService) Do(ctx context.Context) (CatHealthResponse, error) {
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
	var ret CatHealthResponse
	if err := s.client.decoder.Decode(res.Body, &ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a get request.

// CatHealthResponse is the outcome of CatHealthService.Do.
type CatHealthResponse []CatHealthResponseRow

// CatHealthResponseRow is a single row in a CatHealthResponse.
// Notice that not all of these fields might be filled; that depends
// on the number of columns chose in the request (see CatHealthService.Columns).
type CatHealthResponseRow struct {
	Epoch               int64  `json:"epoch,string"`          // e.g. 1527077996
	Timestamp           string `json:"timestamp"`             // e.g. "12:19:56"
	Cluster             string `json:"cluster"`               // cluster name, e.g. "elasticsearch"
	Status              string `json:"status"`                // health status, e.g. "green", "yellow", or "red"
	NodeTotal           int    `json:"node.total,string"`     // total number of nodes
	NodeData            int    `json:"node.data,string"`      // number of nodes that can store data
	Shards              int    `json:"shards,string"`         // total number of shards
	Pri                 int    `json:"pri,string"`            // number of primary shards
	Relo                int    `json:"relo,string"`           // number of relocating nodes
	Init                int    `json:"init,string"`           // number of initializing nodes
	Unassign            int    `json:"unassign,string"`       // number of unassigned shards
	PendingTasks        int    `json:"pending_tasks,string"`  // number of pending tasks
	MaxTaskWaitTime     string `json:"max_task_wait_time"`    // wait time of longest task pending, e.g. "-" or time in millis
	ActiveShardsPercent string `json:"active_shards_percent"` // active number of shards in percent, e.g. "100%"
}
