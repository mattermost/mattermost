// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestPerformanceReport_IsValid(t *testing.T) {
	outdatedTimestamp := time.Now().Add(-6 * time.Minute).UnixMilli()
	tests := []struct {
		name     string
		report   *PerformanceReport
		expected error
	}{
		{
			name: "ValidReport",
			report: &PerformanceReport{
				Version: "0.1.0",
				Labels:  map[string]string{"platform": "linux"},
				Start:   float64(time.Now().UnixMilli() - 10000),
				End:     float64(time.Now().UnixMilli()),
			},
			expected: nil,
		},
		{
			name:     "NilReport",
			report:   nil,
			expected: fmt.Errorf("the report is nil"),
		},
		{
			name: "UnsupportedVersion",
			report: &PerformanceReport{
				Version: "2.0.0",
				Labels:  map[string]string{"platform": "linux"},
				Start:   float64(time.Now().UnixMilli() - 10000),
				End:     float64(time.Now().UnixMilli()),
			},
			expected: fmt.Errorf("report version is not supported: server version: 0.1.0, report version: 2.0.0"),
		},
		{
			name: "ErroneousTimestamps",
			report: &PerformanceReport{
				Version: "0.1.0",
				Labels:  map[string]string{"platform": "linux"},
				Start:   float64(time.Now().UnixMilli()),
				End:     float64(time.Now().Add(-1 * time.Hour).UnixMilli()),
			},
			expected: fmt.Errorf("report timestamps are erroneous"),
		},
		{
			name: "OutdatedReport",
			report: &PerformanceReport{
				Version: "0.1.0",
				Labels:  map[string]string{"platform": "linux"},
				Start:   float64(time.Now().Add(-7 * time.Minute).UnixMilli()),
				End:     float64(outdatedTimestamp),
			},
			expected: fmt.Errorf("report is outdated: %f", float64(outdatedTimestamp)),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.report.IsValid()
			if tt.expected != nil {
				require.EqualError(t, err, tt.expected.Error())
				return
			}
			require.NoError(t, err)
		})
	}
}
