// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"context"
	"net/http"
)

// StatsService handles communication with the stats related methods.
type StatsService struct {
	client *Client
}

// PlaybookSiteStats holds the data that we want to expose in system console
type PlaybookSiteStats struct {
	TotalPlaybooks    int `json:"total_playbooks"`
	TotalPlaybookRuns int `json:"total_playbook_runs"`
}

// Get the stats that should be displayed in system console.
func (s *StatsService) GetSiteStats(ctx context.Context) (*PlaybookSiteStats, error) {
	statsURL := "stats/site"
	req, err := s.client.newRequest(http.MethodGet, statsURL, nil)
	if err != nil {
		return nil, err
	}

	stats := new(PlaybookSiteStats)
	resp, err := s.client.do(ctx, req, stats)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	return stats, nil
}
