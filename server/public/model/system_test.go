// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
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
		{
			name:       "fields at the limits",
			filter:     &LogFilter{Fields: logFilterTestFields(LogFilterFieldsMaxKeys, LogFilterFieldMaxValues, strings.Repeat("é", LogFilterFieldMaxLength))},
			expectedID: "",
		},
		{
			name:       "too many fields are rejected",
			filter:     &LogFilter{Fields: logFilterTestFields(LogFilterFieldsMaxKeys+1, 1, "github")},
			expectedID: "model.log_filter.is_valid.fields.app_error",
		},
		{
			name:       "a field without values is rejected",
			filter:     &LogFilter{Fields: map[string][]string{"plugin_id": {}}},
			expectedID: "model.log_filter.is_valid.field_values.app_error",
		},
		{
			name:       "a field with too many values is rejected",
			filter:     &LogFilter{Fields: logFilterTestFields(1, LogFilterFieldMaxValues+1, "github")},
			expectedID: "model.log_filter.is_valid.field_values.app_error",
		},
		{
			name:       "a field value over the maximum length is rejected",
			filter:     &LogFilter{Fields: map[string][]string{"plugin_id": {strings.Repeat("a", LogFilterFieldMaxLength+1)}}},
			expectedID: "model.log_filter.is_valid.field_value.app_error",
		},
		{
			name:       "an empty field name is rejected",
			filter:     &LogFilter{Fields: map[string][]string{"": {"github"}}},
			expectedID: "model.log_filter.is_valid.field_name.app_error",
		},
		{
			name:       "a field name over the maximum length is rejected",
			filter:     &LogFilter{Fields: map[string][]string{strings.Repeat("a", LogFilterFieldMaxLength+1): {"github"}}},
			expectedID: "model.log_filter.is_valid.field_name.app_error",
		},
		{
			name:       "level has its own filter",
			filter:     &LogFilter{Fields: map[string][]string{"level": {"error"}}},
			expectedID: "model.log_filter.is_valid.field_name.app_error",
		},
		{
			name:       "timestamp has its own filter",
			filter:     &LogFilter{Fields: map[string][]string{"timestamp": {"2020-01-02"}}},
			expectedID: "model.log_filter.is_valid.field_name.app_error",
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

func TestLogFilterFieldDetail(t *testing.T) {
	require.Equal(t, "field=plugin_id", logFilterFieldDetail("plugin_id"))

	atLimit := strings.Repeat("é", LogFilterFieldMaxLength)
	require.Equal(t, "field="+atLimit, logFilterFieldDetail(atLimit))

	appErr := (&LogFilter{Fields: map[string][]string{strings.Repeat("a", 10*LogFilterFieldMaxLength): {"x"}}}).IsValid()
	require.NotNil(t, appErr)
	require.Equal(t, "field="+strings.Repeat("a", LogFilterFieldMaxLength)+"…", appErr.DetailedError)
}

// logFilterTestFields returns keys fields, each with values copies of value.
func logFilterTestFields(keys, values int, value string) map[string][]string {
	fields := make(map[string][]string, keys)
	for i := range keys {
		fields[fmt.Sprintf("field_%d", i)] = slices.Repeat([]string{value}, values)
	}
	return fields
}
