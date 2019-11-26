// Copyright 2012-present Oliver Eilhard. All rights reserved.
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

// SnapshotDeleteService deletes a snapshot from a snapshot repository.
// It is documented at
// https://www.elastic.co/guide/en/elasticsearch/reference/6.8/modules-snapshots.html.
type SnapshotDeleteService struct {
	client     *Client
	repository string
	snapshot   string
}

// NewSnapshotDeleteService creates a new SnapshotDeleteService.
func NewSnapshotDeleteService(client *Client) *SnapshotDeleteService {
	return &SnapshotDeleteService{
		client: client,
	}
}

// Repository is the repository name.
func (s *SnapshotDeleteService) Repository(repository string) *SnapshotDeleteService {
	s.repository = repository
	return s
}

// Snapshot is the snapshot name.
func (s *SnapshotDeleteService) Snapshot(snapshot string) *SnapshotDeleteService {
	s.snapshot = snapshot
	return s
}

// buildURL builds the URL for the operation.
func (s *SnapshotDeleteService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_snapshot/{repository}/{snapshot}", map[string]string{
		"repository": s.repository,
		"snapshot":   s.snapshot,
	})
	if err != nil {
		return "", url.Values{}, err
	}
	return path, url.Values{}, nil
}

// Validate checks if the operation is valid.
func (s *SnapshotDeleteService) Validate() error {
	var invalid []string
	if s.repository == "" {
		invalid = append(invalid, "Repository")
	}
	if s.snapshot == "" {
		invalid = append(invalid, "Snapshot")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *SnapshotDeleteService) Do(ctx context.Context) (*SnapshotDeleteResponse, error) {
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
	ret := new(SnapshotDeleteResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// SnapshotDeleteResponse is the response of SnapshotDeleteService.Do.
type SnapshotDeleteResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
