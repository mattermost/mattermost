// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"
	"time"

	"github.com/blang/semver/v4"
)

type MetricType string

const (
	ClientTimeToFirstByte        MetricType = "TTFB"
	ClientFirstContentfulPaint   MetricType = "FCP"
	ClientLargestContentfulPaint MetricType = "LCP"
	ClientInteractionToNextPaint MetricType = "INP"
	ClientCumulativeLayoutShift  MetricType = "CLS"
	ClientLongTasks              MetricType = "long_tasks"
	ClientPageLoadDuration       MetricType = "page_load"
	ClientChannelSwitchDuration  MetricType = "channel_switch"
	ClientTeamSwitchDuration     MetricType = "team_switch"
	ClientRHSLoadDuration        MetricType = "rhs_load"

	performanceReportTTLMilliseconds = 300 * 1000 // 300 seconds/5 minutes
)

var (
	performanceReportVersion = semver.MustParse("0.1.0")
	acceptedPlatforms        = sliceToMapKey("linux", "macos", "ios", "android", "windows", "other")
	acceptedAgents           = sliceToMapKey("desktop", "firefox", "chrome", "safari", "edge", "other")
)

type MetricSample struct {
	Metric    MetricType        `json:"metric"`
	Value     float64           `json:"value"`
	Timestamp float64           `json:"timestamp,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// PerformanceReport is a set of samples collected from a client
type PerformanceReport struct {
	Version    string            `json:"version"`
	ClientID   string            `json:"client_id"`
	Labels     map[string]string `json:"labels"`
	Start      float64           `json:"start"`
	End        float64           `json:"end"`
	Counters   []*MetricSample   `json:"counters"`
	Histograms []*MetricSample   `json:"histograms"`
}

func (r *PerformanceReport) IsValid() error {
	if r == nil {
		return fmt.Errorf("the report is nil")
	}

	reportVersion, err := semver.ParseTolerant(r.Version)
	if err != nil {
		return err
	}

	if reportVersion.Major != performanceReportVersion.Major || reportVersion.Minor > performanceReportVersion.Minor {
		return fmt.Errorf("report version is not supported: server version: %s, report version: %s", performanceReportVersion.String(), r.Version)
	}

	if r.Start > r.End {
		return fmt.Errorf("report timestamps are erroneous")
	}

	now := time.Now().UnixMilli()
	if r.End < float64(now-performanceReportTTLMilliseconds) {
		return fmt.Errorf("report is outdated: %f", r.End)
	}

	return nil
}

func (r *PerformanceReport) ProcessLabels() map[string]string {
	var platform, agent string
	var ok bool

	// check if the platform is specified
	platform, ok = r.Labels["platform"]
	if !ok {
		platform = "other"
	}
	platform = strings.ToLower(platform)

	// check if platform is one of the accepted platforms
	_, ok = acceptedPlatforms[platform]
	if !ok {
		platform = "other"
	}

	// check if the agent is specified
	agent, ok = r.Labels["agent"]
	if !ok {
		agent = "other"
	}
	agent = strings.ToLower(agent)

	// check if agent is one of the accepted agents
	_, ok = acceptedAgents[agent]
	if !ok {
		agent = "other"
	}

	return map[string]string{
		"platform": platform,
		"agent":    agent,
	}
}
