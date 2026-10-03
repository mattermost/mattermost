// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// PlaybookConditionsService handles communication with the playbook condition related
// methods of the Playbooks API.
type PlaybookConditionsService struct {
	client *Client
}

// Condition represents a condition that can be applied to playbooks and runs.
type Condition struct {
	ID            string          `json:"id"`
	ConditionExpr ConditionExprV1 `json:"condition_expr"`
	Version       int             `json:"version"`
	PlaybookID    string          `json:"playbook_id"`
	RunID         string          `json:"run_id,omitempty"`
	CreateAt      int64           `json:"create_at"`
	UpdateAt      int64           `json:"update_at"`
}

// ConditionExprV1 represents a logical condition expression.
type ConditionExprV1 struct {
	And []ConditionExprV1 `json:"and,omitempty"`
	Or  []ConditionExprV1 `json:"or,omitempty"`

	Is    *ComparisonCondition `json:"is,omitempty"`
	IsNot *ComparisonCondition `json:"isNot,omitempty"`
}

// ComparisonCondition represents a field comparison condition.
type ComparisonCondition struct {
	FieldID string          `json:"field_id"`
	Value   json.RawMessage `json:"value"`
}

// PlaybookConditionListOptions specifies the optional parameters to various
// List methods that support pagination and filtering.
type PlaybookConditionListOptions struct {
	Page    int `url:"page,omitempty"`
	PerPage int `url:"per_page,omitempty"`
}

// GetPlaybookConditionsResults contains the results of the List call.
type GetPlaybookConditionsResults struct {
	TotalCount int         `json:"total_count"`
	PageCount  int         `json:"page_count"`
	HasMore    bool        `json:"has_more"`
	Items      []Condition `json:"items"`
}

// List the conditions for a playbook.
func (s *PlaybookConditionsService) List(ctx context.Context, playbookID string, page, perPage int, opts PlaybookConditionListOptions) (*GetPlaybookConditionsResults, error) {
	conditionURL := fmt.Sprintf("playbooks/%s/conditions", playbookID)
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

	result := &GetPlaybookConditionsResults{}
	resp, err := s.client.do(ctx, req, result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	return result, nil
}

// Create a playbook condition.
func (s *PlaybookConditionsService) Create(ctx context.Context, playbookID string, condition Condition) (*Condition, error) {
	conditionURL := fmt.Sprintf("playbooks/%s/conditions", playbookID)
	req, err := s.client.newAPIRequest(http.MethodPost, conditionURL, condition)
	if err != nil {
		return nil, err
	}

	createdCondition := new(Condition)
	resp, err := s.client.do(ctx, req, createdCondition)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("expected status code %d", http.StatusCreated)
	}

	return createdCondition, nil
}

// Update a playbook condition.
func (s *PlaybookConditionsService) Update(ctx context.Context, playbookID, conditionID string, condition Condition) (*Condition, error) {
	conditionURL := fmt.Sprintf("playbooks/%s/conditions/%s", playbookID, conditionID)
	req, err := s.client.newAPIRequest(http.MethodPut, conditionURL, condition)
	if err != nil {
		return nil, err
	}

	updatedCondition := new(Condition)
	resp, err := s.client.do(ctx, req, updatedCondition)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("expected status code %d", http.StatusOK)
	}

	return updatedCondition, nil
}

// Delete a playbook condition.
func (s *PlaybookConditionsService) Delete(ctx context.Context, playbookID, conditionID string) error {
	conditionURL := fmt.Sprintf("playbooks/%s/conditions/%s", playbookID, conditionID)
	req, err := s.client.newAPIRequest(http.MethodDelete, conditionURL, nil)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("expected status code %d", http.StatusNoContent)
	}

	return nil
}
