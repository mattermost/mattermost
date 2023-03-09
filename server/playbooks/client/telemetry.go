// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
)

type TelemetryService struct {
	client *Client
}

func (s *TelemetryService) CreateEvent(ctx context.Context, name string, eventType string, properties map[string]interface{}) error {

	payload := struct {
		Type       string
		Name       string
		Properties map[string]interface{}
	}{
		Type:       eventType,
		Name:       name,
		Properties: properties,
	}

	req, err := s.client.newRequest(http.MethodPost, "telemetry", payload)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, nil)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		return fmt.Errorf("expected status code %d, got %d: %s", http.StatusNoContent, resp.StatusCode, body)
	}

	return nil
}
