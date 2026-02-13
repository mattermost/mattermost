// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestPerformanceReport_IsValid(t *testing.T) {
	outdatedTimestamp := time.Now().Add(-6 * time.Minute).UnixMilli()
	tests := []struct {
		name     string
		report   *PerformanceReport
		expected string
	}{
		{
			name: "ValidReport",
			report: &PerformanceReport{
				Version: "0.1.0",
				Labels:  map[string]string{"platform": "linux"},
				Start:   float64(time.Now().UnixMilli() - 10000),
				End:     float64(time.Now().UnixMilli()),
			},
			expected: "",
		},
		{
			name:     "NilReport",
			report:   nil,
			expected: "the report is nil",
		},
		{
			name: "UnsupportedVersion",
			report: &PerformanceReport{
				Version: "2.0.0",
				Labels:  map[string]string{"platform": "linux"},
				Start:   float64(time.Now().UnixMilli() - 10000),
				End:     float64(time.Now().UnixMilli()),
			},
			expected: "report version is not supported:",
		},
		{
			name: "ErroneousTimestamps",
			report: &PerformanceReport{
				Version: "0.1.0",
				Labels:  map[string]string{"platform": "linux"},
				Start:   float64(time.Now().UnixMilli()),
				End:     float64(time.Now().Add(-1 * time.Hour).UnixMilli()),
			},
			expected: "report timestamps are erroneous",
		},
		{
			name: "OutdatedReport",
			report: &PerformanceReport{
				Version: "0.1.0",
				Labels:  map[string]string{"platform": "linux"},
				Start:   float64(time.Now().Add(-7 * time.Minute).UnixMilli()),
				End:     float64(outdatedTimestamp),
			},
			expected: "report is outdated:",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.report.IsValid()
			if tt.expected != "" {
				require.Contains(t, err.Error(), tt.expected)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestPerformanceReport_ProcessLabels(t *testing.T) {
	tests := []struct {
		name     string
		labels   map[string]string
		expected map[string]string
	}{
		{
			name: "normalizes known values case-insensitively",
			labels: map[string]string{
				"platform":              "IOS",
				"agent":                 "SafARi",
				"desktop_app_version":   "6.2.0",
				"network_request_group": "websocket reconnect deferred",
			},
			expected: map[string]string{
				"platform":              "ios",
				"agent":                 "safari",
				"desktop_app_version":   "6.2.0",
				"network_request_group": "WebSocket Reconnect Deferred",
			},
		},
		{
			name: "defaults unknown values",
			labels: map[string]string{
				"platform":              "plan9",
				"agent":                 "netscape",
				"network_request_group": "mystery",
			},
			expected: map[string]string{
				"platform":              "other",
				"agent":                 "other",
				"desktop_app_version":   "",
				"network_request_group": "Login",
			},
		},
		{
			name:   "handles missing labels",
			labels: nil,
			expected: map[string]string{
				"platform":              "other",
				"agent":                 "other",
				"desktop_app_version":   "",
				"network_request_group": "Login",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			report := &PerformanceReport{
				Labels: tt.labels,
			}

			require.Equal(t, tt.expected, report.ProcessLabels())
		})
	}
}
