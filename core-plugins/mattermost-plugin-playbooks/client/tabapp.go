// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"fmt"
	"net/http"
)

// LimitedUser returns the minimum amount of user data needed for the app.
type LimitedUser struct {
	UserID    string `json:"user_id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// LimitedUser returns the minimum amount of post data needed for the app.
type LimitedPost struct {
	Message  string `json:"message"`
	CreateAt int64  `json:"create_at"`
	UserID   string `json:"user_id"`
}

type TabAppResults struct {
	TotalCount int                    `json:"total_count"`
	PageCount  int                    `json:"page_count"`
	PerPage    int                    `json:"per_page"`
	HasMore    bool                   `json:"has_more"`
	Items      []PlaybookRun          `json:"items"`
	Users      map[string]LimitedUser `json:"users"`
	Posts      map[string]LimitedPost `json:"posts"`
}

type TabAppService struct {
	client *Client
}

type TabAppGetRunsOptions struct {
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
}

func (s *TabAppService) GetRuns(ctx context.Context, token string, options TabAppGetRunsOptions) (*TabAppResults, error) {
	url := fmt.Sprintf("plugins/%s/tabapp/runs", manifestID)

	url, err := addOptions(url, options)
	if err != nil {
		return nil, err
	}

	req, err := s.client.newRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", token)

	tabAppResults := new(TabAppResults)
	resp, err := s.client.do(ctx, req, tabAppResults)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return tabAppResults, nil
}
