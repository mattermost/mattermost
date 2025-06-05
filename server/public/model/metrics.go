// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"

	"github.com/blang/semver/v4"
)

type MetricType string

const (
	ClientTimeToFirstByte           MetricType = "TTFB"
	ClientTimeToLastByte            MetricType = "TTLB"
	ClientTimeToDOMInteractive      MetricType = "dom_interactive"
	ClientSplashScreenEnd           MetricType = "splash_screen"
	ClientFirstContentfulPaint      MetricType = "FCP"
	ClientLargestContentfulPaint    MetricType = "LCP"
	ClientInteractionToNextPaint    MetricType = "INP"
	ClientCumulativeLayoutShift     MetricType = "CLS"
	ClientLongTasks                 MetricType = "long_tasks"
	ClientPageLoadDuration          MetricType = "page_load"
	ClientChannelSwitchDuration     MetricType = "channel_switch"
	ClientTeamSwitchDuration        MetricType = "team_switch"
	ClientRHSLoadDuration           MetricType = "rhs_load"
	ClientGlobalThreadsLoadDuration MetricType = "global_threads_load"

	MobileClientLoadDuration                           MetricType = "mobile_load"
	MobileClientChannelSwitchDuration                  MetricType = "mobile_channel_switch"
	MobileClientTeamSwitchDuration                     MetricType = "mobile_team_switch"
	MobileClientNetworkRequestsAverageSpeed            MetricType = "mobile_network_requests_average_speed"
	MobileClientNetworkRequestsEffectiveLatency        MetricType = "mobile_network_requests_effective_latency"
	MobileClientNetworkRequestsElapsedTime             MetricType = "mobile_network_requests_elapsed_time"
	MobileClientNetworkRequestsLatency                 MetricType = "mobile_network_requests_latency"
	MobileClientNetworkRequestsTotalCompressedSize     MetricType = "mobile_network_requests_total_compressed_size"
	MobileClientNetworkRequestsTotalParallelRequests   MetricType = "mobile_network_requests_total_parallel_requests"
	MobileClientNetworkRequestsTotalRequests           MetricType = "mobile_network_requests_total_requests"
	MobileClientNetworkRequestsTotalSequentialRequests MetricType = "mobile_network_requests_total_sequential_requests"
	MobileClientNetworkRequestsTotalSize               MetricType = "mobile_network_requests_total_size"

	DesktopClientCPUUsage    MetricType = "desktop_cpu"
	DesktopClientMemoryUsage MetricType = "desktop_memory"

	performanceReportTTLMilliseconds = 300 * 1000 // 300 seconds/5 minutes
)

var (
	performanceReportVersion = semver.MustParse("0.1.0")
	acceptedPlatforms        = SliceToMapKey("linux", "macos", "ios", "android", "windows", "other")
	acceptedAgents           = SliceToMapKey("desktop", "firefox", "chrome", "safari", "edge", "other")

	AcceptedInteractions = SliceToMapKey("keyboard", "pointer", "other")
	AcceptedLCPRegions   = SliceToMapKey(
		"post",
		"post_textbox",
		"channel_sidebar",
		"team_sidebar",
		"channel_header",
		"global_header",
		"announcement_bar",
		"center_channel",
		"modal_content",
		"other",
	)
	AcceptedTrueFalseLabels      = SliceToMapKey("true", "false")
	AcceptedSplashScreenOrigins  = SliceToMapKey("root", "team_controller")
	AcceptedNetworkRequestGroups = SliceToMapKey(
		"Cold Start",
		"Cold Start Deferred",
		"DeepLink",
		"DeepLink Deferred",
		"Login",
		"Login Deferred",
		"Notification",
		"Notification Deferred",
		"Server Switch",
		"Server Switch Deferred",
		"WebSocket Reconnect",
		"WebSocket Reconnect Deferred",
	)
)

type MetricSample struct {
	Metric MetricType        `json:"metric"`
	Value  float64           `json:"value"`
	Labels map[string]string `json:"labels,omitempty"`
}

func (s *MetricSample) GetLabelValue(name string, acceptedValues map[string]any, defaultValue string) string {
	return processLabel(s.Labels, name, acceptedValues, defaultValue)
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
		return fmt.Errorf("could not parse semver version: %s, %w", r.Version, err)
	}

	if reportVersion.Major != performanceReportVersion.Major || reportVersion.Minor > performanceReportVersion.Minor {
		return fmt.Errorf("report version is not supported: server version: %s, report version: %s", performanceReportVersion.String(), r.Version)
	}

	if r.Start > r.End {
		return fmt.Errorf("report timestamps are erroneous: start_timestamp %f is greater than end_timestamp %f", r.Start, r.End)
	}

	now := GetMillis()
	if r.End < float64(now-performanceReportTTLMilliseconds) {
		return fmt.Errorf("report is outdated: end_time %f is past %d ms from now", r.End, performanceReportTTLMilliseconds)
	}

	return nil
}

func (r *PerformanceReport) ProcessLabels() map[string]string {
	return map[string]string{
		"platform":              processLabel(r.Labels, "platform", acceptedPlatforms, "other"),
		"agent":                 processLabel(r.Labels, "agent", acceptedAgents, "other"),
		"desktop_app_version":   r.Labels["desktop_app_version"],
		"network_request_group": processLabel(r.Labels, "network_request_group", AcceptedNetworkRequestGroups, "Login"),
	}
}

func processLabel(labels map[string]string, name string, acceptedValues map[string]any, defaultValue string) string {
	// check if the label is specified
	value, ok := labels[name]
	if !ok {
		return defaultValue
	}
	value = strings.ToLower(value)

	// check if the value is one that we accept
	_, ok = acceptedValues[value]
	if !ok {
		return defaultValue
	}

	return value
}
