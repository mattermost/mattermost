// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package validation

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestValidatePerformanceReport(t *testing.T) {
	now := time.Now()
	start := float64(now.Add(-1 * time.Minute).UnixMilli())
	end := float64(now.UnixMilli())

	tests := []struct {
		name          string
		request       PerformanceReportRequest
		rawBody       string
		expectedError bool
	}{
		{
			name: "Missing client version",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start:      start,
				End:        end,
				Counters:   []*MetricSampleRequest{},
				Histograms: []*MetricSampleRequest{},
				ClientHash: "abc123",
			},
			expectedError: true,
		},
		{
			name: "Missing client hash",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start:         start,
				End:           end,
				Counters:      []*MetricSampleRequest{},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
			},
			expectedError: true,
		},
		{
			name: "Missing version",
			request: PerformanceReportRequest{
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start:         start,
				End:           end,
				Counters:      []*MetricSampleRequest{},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Missing start",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				End:           end,
				Counters:      []*MetricSampleRequest{},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Missing end",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start:         start,
				Counters:      []*MetricSampleRequest{},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Invalid performance report - wrong version",
			request: PerformanceReportRequest{
				Version:  "2.0.0", // Invalid version
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start:         start,
				End:           end,
				Counters:      []*MetricSampleRequest{},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Invalid performance report - erroneous timestamps",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start:         end,   // Start after end
				End:           start, // End before start
				Counters:      []*MetricSampleRequest{},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Invalid counter - missing metric",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start: start,
				End:   end,
				Counters: []*MetricSampleRequest{
					{
						Value: 5,
					},
				},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Invalid counter - missing value",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start: start,
				End:   end,
				Counters: []*MetricSampleRequest{
					{
						Metric: string(model.ClientLongTasks),
					},
				},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Invalid counter - empty metric",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start: start,
				End:   end,
				Counters: []*MetricSampleRequest{
					{
						Metric: "",
						Value:  5,
					},
				},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Invalid counter - invalid timestamp",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels:   map[string]string{"platform": "linux", "agent": "desktop"},
				Start:    start,
				End:      end,
				Counters: []*MetricSampleRequest{
					{
						Metric:    string(model.ClientLongTasks),
						Value:     5,
						Timestamp: -1, // Invalid timestamp
						Labels:    map[string]string{"browser": "chrome"},
					},
				},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name: "Invalid counter - invalid labels",
			request: PerformanceReportRequest{
				Version:  "0.1.0",
				ClientID: "test-client",
				Labels: map[string]string{
					"platform": "linux",
					"agent":    "desktop",
				},
				Start: start,
				End:   end,
				Counters: []*MetricSampleRequest{
					{
						Metric: string(model.ClientLongTasks),
						Value:  5,
						Labels: map[string]string{
							"": "invalid", // Empty key
						},
					},
				},
				Histograms:    []*MetricSampleRequest{},
				ClientVersion: "1.0.0",
				ClientHash:    "abc123",
			},
			expectedError: true,
		},
		{
			name:          "Invalid request - malformed JSON",
			rawBody:       "{invalid json",
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req *http.Request

			if tt.rawBody != "" {
				// Use raw body if provided (for malformed JSON test)
				var err error
				req, err = http.NewRequest(http.MethodPost, "/api/v4/metrics/performance", bytes.NewBufferString(tt.rawBody))
				require.NoError(t, err)
			} else {
				// Create request body from struct
				body, err := json.Marshal(tt.request)
				require.NoError(t, err)
				req, err = http.NewRequest(http.MethodPost, "/api/v4/metrics/performance", bytes.NewReader(body))
				require.NoError(t, err)
			}

			// Validate request
			appErr := ValidatePerformanceReport(req)

			if tt.expectedError {
				require.NotNil(t, appErr, "Expected an error for invalid request")
				require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
			} else {
				require.Nil(t, appErr, "Expected no error for valid request")
			}
		})
	}
}
