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
	StartUnixMilli int64
	Page           int
	PerPage        int
}

type TopReactionList struct {
	HasNext bool           `json:"has_next"`
	Items   []*TopReaction `json:"items"`
}

type TopReaction struct {
	EmojiName string `json:"emoji_name"`
	Count     int64  `json:"count"`
	Rank      int    `json:"rank"`
}

// GetStartUnixMilliForTimeRange gets the unix start time in milliseconds from the given time range.
// Time range can be one of: "1_day", "7_day", or "28_day".
func GetStartUnixMilliForTimeRange(timeRange string) (int64, *AppError) {
	switch timeRange {
	case TimeRange1Day:
		return GetMillisForTime(time.Now().Add(time.Hour * time.Duration(-24))), nil
	case TimeRange7Day:
		return GetMillisForTime(time.Now().Add(time.Hour * time.Duration(-168))), nil
	case TimeRange28Day:
		return GetMillisForTime(time.Now().Add(time.Hour * time.Duration(-672))), nil
	}

	return GetMillisForTime(time.Now()), NewAppError("Insights.IsValidRequest", "model.insights.time_range.app_error", nil, "", http.StatusBadRequest)
}
