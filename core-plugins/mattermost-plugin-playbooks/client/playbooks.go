// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/pkg/errors"
)

// PlaybooksService handles communication with the playbook related
// methods of the Playbook API.
type PlaybooksService struct {
	client *Client
}

// Get a playbook.
func (s *PlaybooksService) Get(ctx context.Context, playbookID string) (*Playbook, error) {
	playbookURL := fmt.Sprintf("playbooks/%s", playbookID)
	req, err := s.client.newAPIRequest(http.MethodGet, playbookURL, nil)
	if err != nil {
		return nil, err
	}

	playbook := new(Playbook)
	resp, err := s.client.do(ctx, req, playbook)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return playbook, nil
}

// List the playbooks.
func (s *PlaybooksService) List(ctx context.Context, teamId string, page, perPage int, opts PlaybookListOptions) (*GetPlaybooksResults, error) {
	playbookURL := "playbooks"
	playbookURL, err := addOption(playbookURL, "team_id", teamId)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}

	playbookURL, err = addPaginationOptions(playbookURL, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("failed to build pagination options: %w", err)
	}

	playbookURL, err = addOptions(playbookURL, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to build options: %w", err)
	}

	req, err := s.client.newAPIRequest(http.MethodGet, playbookURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	result := &GetPlaybooksResults{}
	resp, err := s.client.do(ctx, req, result)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	return result, nil
}

// Create a playbook. Returns the id of the newly created playbook
func (s *PlaybooksService) Create(ctx context.Context, opts PlaybookCreateOptions) (string, error) {
	// For ease of use set the default if not specificed so it doesn't just error
	if opts.ReminderTimerDefaultSeconds == 0 {
		opts.ReminderTimerDefaultSeconds = 86400
	}

	playbookURL := "playbooks"
	req, err := s.client.newAPIRequest(http.MethodPost, playbookURL, opts)
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

func (s *PlaybooksService) Update(ctx context.Context, playbook Playbook) error {
	updateURL := fmt.Sprintf("playbooks/%s", playbook.ID)
	req, err := s.client.newAPIRequest(http.MethodPut, updateURL, playbook)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}

func (s *PlaybooksService) Archive(ctx context.Context, playbookID string) error {
	updateURL := fmt.Sprintf("playbooks/%s", playbookID)
	req, err := s.client.newAPIRequest(http.MethodDelete, updateURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}

func (s *PlaybooksService) Export(ctx context.Context, playbookID string) ([]byte, error) {
	url := fmt.Sprintf("playbooks/%s/export", playbookID)
	req, err := s.client.newAPIRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	result, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("expected status code %d", http.StatusOK)
	}

	return result, nil
}

// Duplicate a playbook. Returns the id of the newly created playbook
func (s *PlaybooksService) Duplicate(ctx context.Context, playbookID string) (string, error) {
	url := fmt.Sprintf("playbooks/%s/duplicate", playbookID)
	req, err := s.client.newAPIRequest(http.MethodPost, url, nil)
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

// Imports a playbook. Returns the id of the newly created playbook
func (s *PlaybooksService) Import(ctx context.Context, toImport []byte, team string) (string, error) {
	url := "playbooks/import?team_id=" + team
	u, err := s.client.BaseURL.Parse(buildAPIURL(url))
	if err != nil {
		return "", errors.Wrapf(err, "invalid endpoint %s", url)
	}
	req, err := http.NewRequest(http.MethodPost, u.String(), bytes.NewReader(toImport))
	if err != nil {
		return "", errors.Wrapf(err, "failed to create http request for import")
	}
	req.Header.Set("Content-Type", "application/json")

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

func (s *PlaybooksService) Stats(ctx context.Context, playbookID string) (*PlaybookStats, error) {
	playbookStatsURL := fmt.Sprintf("stats/playbook?playbook_id=%s", playbookID)
	req, err := s.client.newAPIRequest(http.MethodGet, playbookStatsURL, nil)
	if err != nil {
		return nil, err
	}

	stats := new(PlaybookStats)
	resp, err := s.client.do(ctx, req, stats)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return stats, nil
}

func (s *PlaybooksService) AutoFollow(ctx context.Context, playbookID string, userID string) error {
	followsURL := fmt.Sprintf("playbooks/%s/autofollows/%s", playbookID, userID)
	req, err := s.client.newAPIRequest(http.MethodPut, followsURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}
	return nil
}

func (s *PlaybooksService) AutoUnfollow(ctx context.Context, playbookID string, userID string) error {
	followsURL := fmt.Sprintf("playbooks/%s/autofollows/%s", playbookID, userID)
	req, err := s.client.newAPIRequest(http.MethodDelete, followsURL, nil)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}
	return nil
}

func (s *PlaybooksService) GetAutoFollows(ctx context.Context, playbookID string) ([]string, error) {
	autofollowsURL := fmt.Sprintf("playbooks/%s/autofollows", playbookID)
	req, err := s.client.newAPIRequest(http.MethodGet, autofollowsURL, nil)
	if err != nil {
		return nil, err
	}

	var followers []string
	resp, err := s.client.do(ctx, req, &followers)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return followers, nil
}

// GetPropertyFields gets all property fields for a playbook. It is a wrapper around GetPropertyFieldsSince with updatedSince set to 0.
func (s *PlaybooksService) GetPropertyFields(ctx context.Context, playbookID string) ([]PropertyField, error) {
	return s.GetPropertyFieldsSince(ctx, playbookID, 0)
}

// GetPropertyFieldsSince gets all property fields for a playbook.
// updatedSince: optional timestamp in milliseconds - only return fields updated after this time (0 = all)
func (s *PlaybooksService) GetPropertyFieldsSince(ctx context.Context, playbookID string, updatedSince int64) ([]PropertyField, error) {
	propertyFieldsURL := fmt.Sprintf("playbooks/%s/property_fields", playbookID)
	if updatedSince > 0 {
		propertyFieldsURL = fmt.Sprintf("%s?updated_since=%d", propertyFieldsURL, updatedSince)
	}
	req, err := s.client.newAPIRequest(http.MethodGet, propertyFieldsURL, nil)
	if err != nil {
		return nil, err
	}

	var fields []PropertyField
	resp, err := s.client.do(ctx, req, &fields)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return fields, nil
}

// CreatePropertyField creates a new property field for a playbook.
func (s *PlaybooksService) CreatePropertyField(ctx context.Context, playbookID string, field PropertyFieldRequest) (*PropertyField, error) {
	propertyFieldsURL := fmt.Sprintf("playbooks/%s/property_fields", playbookID)
	req, err := s.client.newAPIRequest(http.MethodPost, propertyFieldsURL, field)
	if err != nil {
		return nil, err
	}

	propertyField := new(PropertyField)
	resp, err := s.client.do(ctx, req, propertyField)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return propertyField, nil
}

// UpdatePropertyField updates an existing property field for a playbook.
func (s *PlaybooksService) UpdatePropertyField(ctx context.Context, playbookID, fieldID string, field PropertyFieldRequest) (*PropertyField, error) {
	propertyFieldURL := fmt.Sprintf("playbooks/%s/property_fields/%s", playbookID, fieldID)
	req, err := s.client.newAPIRequest(http.MethodPut, propertyFieldURL, field)
	if err != nil {
		return nil, err
	}

	propertyField := new(PropertyField)
	resp, err := s.client.do(ctx, req, propertyField)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return propertyField, nil
}

// DeletePropertyField deletes a property field from a playbook.
func (s *PlaybooksService) DeletePropertyField(ctx context.Context, playbookID, fieldID string) error {
	propertyFieldURL := fmt.Sprintf("playbooks/%s/property_fields/%s", playbookID, fieldID)
	req, err := s.client.newAPIRequest(http.MethodDelete, propertyFieldURL, nil)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}
	resp.Body.Close()

	return nil
}
