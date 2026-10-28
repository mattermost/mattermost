// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

type BotService struct {
	client *Client
}

// List the conditions for a run (read-only).
func (s *BotService) Connect(ctx context.Context) error {
	connectURL := "bot/connect"
	req, err := s.client.newAPIRequest(http.MethodGet, connectURL, nil)
	if err != nil {
		return fmt.Errorf("failed to build request: %w", err)
	}

	resp, err := s.client.do(ctx, req, nil)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}

	return fmt.Errorf("unable to connect the bot: %d", resp.StatusCode)
}
