// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
)

type RemindersService struct {
	client *Client
}

func (s *RemindersService) Reset(ctx context.Context, playbookRunID string, payload ReminderResetPayload) error {
	resetURL := fmt.Sprintf("runs/%s/reminder", playbookRunID)

	req, err := s.client.newRequest(http.MethodPost, resetURL, payload)
	if err != nil {
		return err
	}

	resp, err := s.client.do(ctx, req, ioutil.Discard)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("expected status code %d", http.StatusNoContent)
	}

	return nil
}
