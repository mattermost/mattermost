// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

// RunConditionsService handles communication with the run condition related
// methods of the Playbooks API. Run conditions are read-only.
type RunConditionsService struct {
	client *Client
}

// RunConditionListOptions specifies the optional parameters to various
// List methods that support pagination and filtering for run conditions.
type RunConditionListOptions struct {
	Page    int `url:"page,omitempty"`
	PerPage int `url:"per_page,omitempty"`
}

// GetRunConditionsResults contains the results of the List call for run conditions.
type GetRunConditionsResults struct {
	TotalCount int         `json:"total_count"`
	PageCount  int         `json:"page_count"`
	HasMore    bool        `json:"has_more"`
	Items      []Condition `json:"items"`
}

// List the conditions for a run (read-only).
func (s *RunConditionsService) List(ctx context.Context, runID string, page, perPage int, opts RunConditionListOptions) (*GetRunConditionsResults, error) {
	conditionURL := fmt.Sprintf("runs/%s/conditions", runID)
	conditionURL, err := addPaginationOptions(conditionURL, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("failed to build pagination options: %w", err)
	}

	conditionURL, err = addOptions(conditionURL, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}

	req, err := s.client.newAPIRequest(http.MethodGet, conditionURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	result := &GetRunConditionsResults{}
	resp, err := s.client.do(ctx, req, result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	return result, nil
}
