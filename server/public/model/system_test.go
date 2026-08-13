// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLogFilterIsValid(t *testing.T) {
	validDate := "2020-01-02 15:04:05.000 +00:00"

	testCases := []struct {
		name       string
		filter     *LogFilter
		expectedID string
	}{
		{
			name:   "nil filter is valid",
			filter: nil,
		},
		{
			name:   "empty bounds mean unbounded",
			filter: &LogFilter{DateFrom: "", DateTo: ""},
		},
		{
			name:   "valid bounds",
			filter: &LogFilter{DateFrom: validDate, DateTo: validDate},
		},
		{
			name:   "valid from with empty to",
			filter: &LogFilter{DateFrom: validDate, DateTo: ""},
		},
		{
			name:   "valid to with empty from",
			filter: &LogFilter{DateFrom: "", DateTo: validDate},
		},
		{
			name:       "malformed from is rejected",
			filter:     &LogFilter{DateFrom: "not-a-date", DateTo: ""},
			expectedID: "model.log_filter.is_valid.date_from.app_error",
		},
		{
			name:       "malformed to is rejected",
			filter:     &LogFilter{DateFrom: "", DateTo: "also-not-a-date"},
			expectedID: "model.log_filter.is_valid.date_to.app_error",
		},
		{
			name:       "from is checked before to",
			filter:     &LogFilter{DateFrom: "not-a-date", DateTo: "also-not-a-date"},
			expectedID: "model.log_filter.is_valid.date_from.app_error",
		},
		{
			name:       "wrong layout is rejected",
			filter:     &LogFilter{DateFrom: "2020-01-02T15:04:05Z", DateTo: ""},
			expectedID: "model.log_filter.is_valid.date_from.app_error",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			appErr := tc.filter.IsValid()
			if tc.expectedID == "" {
				require.Nil(t, appErr)
				return
			}

			require.NotNil(t, appErr)
			require.Equal(t, tc.expectedID, appErr.Id)
			require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		})
	}
}
