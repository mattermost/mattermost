// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"strings"
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
			name:       "nil filter is valid",
			filter:     nil,
			expectedID: "",
		},
		{
			name:       "empty bounds mean unbounded",
			filter:     &LogFilter{DateFrom: "", DateTo: ""},
			expectedID: "",
		},
		{
			name:       "valid bounds",
			filter:     &LogFilter{DateFrom: validDate, DateTo: validDate},
			expectedID: "",
		},
		{
			name:       "valid from with empty to",
			filter:     &LogFilter{DateFrom: validDate, DateTo: ""},
			expectedID: "",
		},
		{
			name:       "valid to with empty from",
			filter:     &LogFilter{DateFrom: "", DateTo: validDate},
			expectedID: "",
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
			name:       "malformed to is rejected with valid from",
			filter:     &LogFilter{DateFrom: validDate, DateTo: "also-not-a-date"},
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
		{
			name:       "search at the maximum length",
			filter:     &LogFilter{Search: strings.Repeat("é", LogFilterSearchMaxLength)},
			expectedID: "",
		},
		{
			name:       "search over the maximum length is rejected",
			filter:     &LogFilter{Search: strings.Repeat("a", LogFilterSearchMaxLength+1)},
			expectedID: "model.log_filter.is_valid.search.app_error",
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

// The webapp and remote cluster nodes send the term under this name
func TestLogFilterSearchJSON(t *testing.T) {
	data, err := json.Marshal(&LogFilter{Search: "websocket"})
	require.NoError(t, err)
	require.Contains(t, string(data), `"search":"websocket"`)
}
