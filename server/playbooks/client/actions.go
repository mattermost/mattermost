// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

// ActionsService handles communication with the actions related
// methods of the Playbook API.
type ActionsService struct {
	client *Client
}

// Create an action. Returns the id of the newly created action.
func (s *ActionsService) Create(ctx context.Context, channelID string, opts ChannelActionCreateOptions) (string, error) {
	actionURL := fmt.Sprintf("actions/channels/%s", channelID)
	req, err := s.client.newRequest(http.MethodPost, actionURL, opts)
	if err != nil {
		return "", err
	}

	var result struct {
		ID string `json:"id"`
	}
	resp, err := s.client.do(ctx, req, &result)
	if err != nil {
		return "", err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("expected status code %d", http.StatusCreated)
	}

	return result.ID, nil
}

// List the actions in a channel.
func (s *ActionsService) List(ctx context.Context, channelID string, opts ChannelActionListOptions) ([]GenericChannelAction, error) {
	actionURL, err := addOptions(fmt.Sprintf("actions/channels/%s", channelID), opts)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}

	req, err := s.client.newRequest(http.MethodGet, actionURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	result := []GenericChannelAction{}
	resp, err := s.client.do(ctx, req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	return result, nil
}

// Update an existing action.
func (s *ActionsService) Update(ctx context.Context, action GenericChannelAction) error {
	updateURL := fmt.Sprintf("actions/channels/%s/%s", action.ChannelID, action.ID)
	req, err := s.client.newRequest(http.MethodPut, updateURL, action)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}
