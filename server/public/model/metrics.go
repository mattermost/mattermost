// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"time"
)

type MetricType string

const (
	ClientMetricChannelVisited MetricType = "channel_visited"
	ClientMetricChannelLoad    MetricType = "channel_load"

	performanceReportTTLMilliseconds = 300 * 1000 // 300 seconds/5 minutes
)

type MetricSample struct {
	Metric    MetricType        `json:"metric"`
	Value     int64             `json:"value"`
	Timestamp int64             `json:"timestamp,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// PerformanceReport is a set of samples collected from a client
type PerformanceReport struct {
	Version    string            `json:"version"`
	ClientID   string            `json:"client_id"`
	Labels     map[string]string `json:"labels"`
	Start      int64             `json:"start"`
	End        int64             `json:"end"`
	Counters   []*MetricSample   `json:"counters"`
	Histograms []*MetricSample   `json:"histograms"`
}

func (r *PerformanceReport) IsValidTime() error {
	now := time.Now().UnixMilli()
	if r.End < now-performanceReportTTLMilliseconds {
		return fmt.Errorf("report is outdated: %d", r.End)
	}

	return nil
}
