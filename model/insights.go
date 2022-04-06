// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"time"
)

const (
	TimeRange1Day  string = "1_day"
	TimeRange7Day  string = "7_day"
	TimeRange28Day string = "28_day"
)

type InsightsOpts struct {
	TimeRange int64
	Page      int
	PerPage   int
}

type TopReactions struct {
	EmojiName string `json:"emoji_name"`
	Count     int64  `json:"count"`
}

// GetTimeRange converts the timeRange string to an int64 Unix time
// timeRange can be one of: "1_day", "7_day", "28_day"
func GetTimeRange(timeRange string) (int64, *AppError) {
	switch timeRange {
	case TimeRange1Day:
		return time.Now().Add(time.Hour * time.Duration(-24)).UnixMilli(), nil
	case TimeRange7Day:
		return time.Now().Add(time.Hour * time.Duration(-168)).UnixMilli(), nil
	case TimeRange28Day:
		return time.Now().Add(time.Hour * time.Duration(-672)).UnixMilli(), nil
	}

	return time.Now().UnixMilli(), NewAppError("Insights.IsValidRequest", "model.insights.time_range.app_error", nil, "", http.StatusBadRequest)
}
