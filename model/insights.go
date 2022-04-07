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

// GetTopReactionListWithRankAndPagination adds a rank to each item in the given list of TopReaction and checks if there is
// another page that can be fetched based on the given limit and offset. The given list of TopReaction is assumed to be
// sorted by Count. Returns a TopReactionList.
func GetTopReactionListWithRankAndPagination(reactions []*TopReaction, limit int, offset int) *TopReactionList {
	// Add pagination support
	var hasNext bool
	if (limit != 0) && (len(reactions) == limit+1) {
		hasNext = true
		reactions = reactions[:len(reactions)-1]
	}

	// Assign rank to each reaction
	for i, reaction := range reactions {
		reaction.Rank = offset + i + 1
	}

	return &TopReactionList{HasNext: hasNext, Items: reactions}
}
