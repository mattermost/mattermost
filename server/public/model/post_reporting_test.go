// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/base64"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReportPostQueryParamsValidate(t *testing.T) {
	tests := []struct {
		name      string
		params    ReportPostQueryParams
		wantError bool
		errorMsg  string
	}{
		{
			name: "valid params with create_at ASC",
			params: ReportPostQueryParams{
				ChannelId:          NewId(),
				CursorTime:         0,
				CursorId:           "",
				TimeField:          ReportingTimeFieldCreateAt,
				SortDirection:      ReportingSortDirectionAsc,
				IncludeDeleted:     false,
				ExcludeSystemPosts: false,
				PerPage:            100,
			},
			wantError: false,
		},
		{
			name: "valid params with update_at DESC and cursor",
			params: ReportPostQueryParams{
				ChannelId:          NewId(),
				CursorTime:         123456789,
				CursorId:           NewId(),
				TimeField:          ReportingTimeFieldUpdateAt,
				SortDirection:      ReportingSortDirectionDesc,
				IncludeDeleted:     true,
				ExcludeSystemPosts: true,
				PerPage:            1000,
			},
			wantError: false,
		},
		{
			name: "empty ChannelId",
			params: ReportPostQueryParams{
				ChannelId:     "",
				TimeField:     ReportingTimeFieldCreateAt,
				SortDirection: ReportingSortDirectionAsc,
				PerPage:       100,
			},
			wantError: true,
			errorMsg:  "channel_id must be a valid 26-character ID",
		},
		{
			name: "invalid ChannelId format",
			params: ReportPostQueryParams{
				ChannelId:     "invalid_id",
				TimeField:     ReportingTimeFieldCreateAt,
				SortDirection: ReportingSortDirectionAsc,
				PerPage:       100,
			},
			wantError: true,
			errorMsg:  "channel_id must be a valid 26-character ID",
		},
		{
			name: "invalid TimeField",
			params: ReportPostQueryParams{
				ChannelId:     NewId(),
				TimeField:     "invalid_field",
				SortDirection: ReportingSortDirectionAsc,
				PerPage:       100,
			},
			wantError: true,
			errorMsg:  "time_field must be",
		},
		{
			name: "SQL injection attempt in TimeField",
			params: ReportPostQueryParams{
				ChannelId:     NewId(),
				TimeField:     "'; DROP TABLE Posts--",
				SortDirection: ReportingSortDirectionAsc,
				PerPage:       100,
			},
			wantError: true,
			errorMsg:  "time_field must be",
		},
		{
			name: "invalid SortDirection",
			params: ReportPostQueryParams{
				ChannelId:     NewId(),
				TimeField:     ReportingTimeFieldCreateAt,
				SortDirection: "random",
				PerPage:       100,
			},
			wantError: true,
			errorMsg:  "sort_direction must be",
		},
		{
			name: "SQL injection attempt in SortDirection",
			params: ReportPostQueryParams{
				ChannelId:     NewId(),
				TimeField:     ReportingTimeFieldCreateAt,
				SortDirection: "ASC; DROP TABLE Posts--",
				PerPage:       100,
			},
			wantError: true,
			errorMsg:  "sort_direction must be",
		},
		{
			name: "invalid CursorId format",
			params: ReportPostQueryParams{
				ChannelId:     NewId(),
				CursorId:      "invalid_cursor_id",
				TimeField:     ReportingTimeFieldCreateAt,
				SortDirection: ReportingSortDirectionAsc,
				PerPage:       100,
			},
			wantError: true,
			errorMsg:  "cursor_id must be a valid 26-character ID",
		},
		{
			name: "empty CursorId is valid (first page)",
			params: ReportPostQueryParams{
				ChannelId:     NewId(),
				CursorId:      "",
				TimeField:     ReportingTimeFieldCreateAt,
				SortDirection: ReportingSortDirectionAsc,
				PerPage:       100,
			},
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.params.Validate()
			if tt.wantError {
				require.NotNil(t, err, "expected error but got nil")
				require.Contains(t, err.Error(), tt.errorMsg)
			} else {
				require.Nil(t, err, "expected nil error but got: %v", err)
			}
		})
	}
}

func TestDecodeReportPostCursorV1(t *testing.T) {
	validChannelId := NewId()
	validPostId := NewId()

	tests := []struct {
		name      string
		cursor    string
		wantError bool
		errorMsg  string
		validate  func(*testing.T, *ReportPostQueryParams)
	}{
		{
			name:      "valid cursor with create_at ASC",
			cursor:    EncodeReportPostCursor(validChannelId, ReportingTimeFieldCreateAt, false, false, ReportingSortDirectionAsc, 1640000000000, validPostId),
			wantError: false,
			validate: func(t *testing.T, params *ReportPostQueryParams) {
				require.Equal(t, validChannelId, params.ChannelId)
				require.Equal(t, ReportingTimeFieldCreateAt, params.TimeField)
				require.Equal(t, ReportingSortDirectionAsc, params.SortDirection)
				require.Equal(t, int64(1640000000000), params.CursorTime)
				require.Equal(t, validPostId, params.CursorId)
				require.False(t, params.IncludeDeleted)
				require.False(t, params.ExcludeSystemPosts)
			},
		},
		{
			name:      "valid cursor with update_at DESC",
			cursor:    EncodeReportPostCursor(validChannelId, ReportingTimeFieldUpdateAt, true, true, ReportingSortDirectionDesc, 1650000000000, validPostId),
			wantError: false,
			validate: func(t *testing.T, params *ReportPostQueryParams) {
				require.Equal(t, validChannelId, params.ChannelId)
				require.Equal(t, ReportingTimeFieldUpdateAt, params.TimeField)
				require.Equal(t, ReportingSortDirectionDesc, params.SortDirection)
				require.Equal(t, int64(1650000000000), params.CursorTime)
				require.Equal(t, validPostId, params.CursorId)
				require.True(t, params.IncludeDeleted)
				require.True(t, params.ExcludeSystemPosts)
			},
		},
		{
			name:      "invalid base64",
			cursor:    "not-valid-base64!!!",
			wantError: true,
			errorMsg:  "invalid_base64",
		},
		{
			name:      "invalid format - too few parts",
			cursor:    base64.URLEncoding.EncodeToString([]byte("1:abc:create_at:false:false:asc:123")),
			wantError: true,
			errorMsg:  "invalid_format",
		},
		{
			name:      "invalid version",
			cursor:    base64.URLEncoding.EncodeToString([]byte("2:abc123xyz789012345678901234:create_at:false:false:asc:1640000000000:post123")),
			wantError: true,
			errorMsg:  "unsupported_version",
		},
		{
			name:      "invalid boolean for include_deleted",
			cursor:    base64.URLEncoding.EncodeToString(fmt.Appendf(nil, "1:%s:create_at:not_bool:false:asc:1640000000000:%s", validChannelId, validPostId)),
			wantError: true,
			errorMsg:  "invalid_include_deleted",
		},
		{
			name:      "invalid boolean for exclude_system_posts",
			cursor:    base64.URLEncoding.EncodeToString(fmt.Appendf(nil, "1:%s:create_at:false:not_bool:asc:1640000000000:%s", validChannelId, validPostId)),
			wantError: true,
			errorMsg:  "invalid_exclude_system_posts",
		},
		{
			name:      "invalid timestamp",
			cursor:    base64.URLEncoding.EncodeToString(fmt.Appendf(nil, "1:%s:create_at:false:false:asc:not_a_number:%s", validChannelId, validPostId)),
			wantError: true,
			errorMsg:  "invalid_timestamp",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params, err := DecodeReportPostCursorV1(tt.cursor)
			if tt.wantError {
				require.NotNil(t, err, "expected error but got nil")
				require.Contains(t, err.Error(), tt.errorMsg)
				require.Nil(t, params)
			} else {
				require.Nil(t, err, "expected nil error but got: %v", err)
				require.NotNil(t, params)
				if tt.validate != nil {
					tt.validate(t, params)
				}
			}
		})
	}
}
