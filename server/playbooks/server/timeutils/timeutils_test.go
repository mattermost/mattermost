// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package timeutils

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDurationString(t *testing.T) {
	now := time.Now()

	testCases := []struct {
		name     string
		start    time.Time
		end      time.Time
		expected string
	}{
		{
			name:     "Duration zero",
			start:    now,
			end:      now,
			expected: "< 1m",
		},
		{
			name:     "Only seconds",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 1, 10, 0, 25, 0, time.UTC),
			expected: "< 1m",
		},
		{
			name:     "Exact minutes",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 1, 10, 15, 0, 0, time.UTC),
			expected: "15m",
		},
		{
			name:     "Minutes and seconds",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 1, 10, 30, 25, 0, time.UTC),
			expected: "30m",
		},
		{
			name:     "Exact hours",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 1, 13, 0, 0, 0, time.UTC),
			expected: "3h",
		},
		{
			name:     "Hours and minutes",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 1, 12, 45, 0, 0, time.UTC),
			expected: "2h 45m",
		},
		{
			name:     "Hours, minutes and seconds",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 1, 20, 59, 10, 0, time.UTC),
			expected: "10h 59m",
		},
		{
			name:     "Exact days",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 2, 10, 0, 0, 0, time.UTC),
			expected: "1d",
		},
		{
			name:     "Days and seconds",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 3, 10, 0, 25, 0, time.UTC),
			expected: "2d",
		},
		{
			name:     "Days and exact minutes",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 5, 10, 15, 0, 0, time.UTC),
			expected: "4d 15m",
		},
		{
			name:     "Days, minutes and seconds",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 10, 10, 30, 25, 0, time.UTC),
			expected: "9d 30m",
		},
		{
			name:     "Days and hours",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 21, 13, 0, 0, 0, time.UTC),
			expected: "20d 3h",
		},
		{
			name:     "Days, hours and minutes",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 26, 12, 45, 0, 0, time.UTC),
			expected: "25d 2h 45m",
		},
		{
			name:     "Days, hours, minutes and seconds",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 1, 31, 20, 59, 10, 0, time.UTC),
			expected: "30d 10h 59m",
		},
		{
			name:     "Days, hours, minutes and seconds over months",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2000, 2, 31, 20, 59, 10, 0, time.UTC),
			expected: "61d 10h 59m",
		},
		{
			name:     "Days, hours, minutes and seconds over years",
			start:    time.Date(2000, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2001, 2, 31, 20, 59, 10, 0, time.UTC),
			expected: "427d 10h 59m",
		},
		{
			name:     "An exact year",
			start:    time.Date(2001, 1, 1, 10, 0, 0, 0, time.UTC),
			end:      time.Date(2002, 1, 1, 10, 0, 0, 0, time.UTC),
			expected: "365d",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			actual := DurationString(testCase.start, testCase.end)
			require.Equal(t, testCase.expected, actual)
		})
	}
}
