// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"time"
)

type InsightsOpts struct {
	TimeRange string
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
	case "1_day":
		return time.Now().Add(time.Hour * time.Duration(-24)).Unix(), nil
	case "7_day":
		return time.Now().Add(time.Hour * time.Duration(-168)).Unix(), nil
	case "28_day":
		return time.Now().Add(time.Hour * time.Duration(-672)).Unix(), nil
	}

	return time.Now().Unix(), NewAppError("Insights.IsValidRequest", "model.insights.time_range.app_error", nil, "", http.StatusBadRequest)
}
