// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"net/http"
)

type GlobalSettings struct {
	// EnableExperimentalFeatures is a read-only field set to true when experimental features
	// are enabled. Changing this field requires access to the system console plugin
	// configuration.
	EnableExperimentalFeatures bool `json:"enable_experimental_features"`
}

// SettingsService handles communication with the settings related methods.
type SettingsService struct {
	client *Client
}

// Get the configured settings.
func (s *SettingsService) Get(ctx context.Context) (*GlobalSettings, error) {
	settingsURL := "settings"
	req, err := s.client.newRequest(http.MethodGet, settingsURL, nil)
	if err != nil {
		return nil, err
	}

	settings := new(GlobalSettings)
	resp, err := s.client.do(ctx, req, settings)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return settings, nil
}

// Update the configured settings.
func (s *SettingsService) Update(ctx context.Context, settings GlobalSettings) error {
	settingsURL := "settings"
	req, err := s.client.newRequest(http.MethodPut, settingsURL, settings)
	if err != nil {
		return err
	}

	_, err = s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}

	return nil
}
