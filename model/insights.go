// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"time"
)

type PostCountGrouping string

const (
	TimeRangeToday string = "today"
	TimeRange7Day  string = "7_day"
	TimeRange28Day string = "28_day"

	PostsByHour PostCountGrouping = "hour"
	PostsByDay  PostCountGrouping = "day"
)

type InsightsOpts struct {
	StartUnixMilli int64
	Page           int
	PerPage        int
}

type InsightsListData struct {
	HasNext bool `json:"has_next"`
}

// Top Reactions
type TopReactionList struct {
	InsightsListData
	Items []*TopReaction `json:"items"`
}

type TopReaction struct {
	EmojiName string `json:"emoji_name"`
	Count     int64  `json:"count"`
}

// Top Channels
type TopChannelList struct {
	InsightsListData
	Items               []*TopChannel              `json:"items"`
	PostCountByDuration ChannelPostCountByDuration `json:"channel_post_counts_by_duration"`
}

func (t *TopChannelList) ChannelIDs() []string {
	var ids []string
	for _, item := range t.Items {
		ids = append(ids, item.ID)
	}
	return ids
}

type TopChannel struct {
	ID           string      `json:"id"`
	Type         ChannelType `json:"type"`
	DisplayName  string      `json:"display_name"`
	Name         string      `json:"name"`
	TeamID       string      `json:"team_id"`
	MessageCount int64       `json:"message_count"`
}

type DurationPostCount struct {
	ChannelID string `db:"channelid"`
	// Duration is a string representing a date in ISO8601 format (ex. 2022-05-26) or an
	Duration  string `db:"duration"`
	PostCount int    `db:"postcount"`
}

func TimeRangeToNumberDays(timeRange string) int {
	var n int
	switch timeRange {
	case TimeRangeToday:
		n = 1
	case TimeRange7Day:
		n = 7
	case TimeRange28Day:
		n = 28
	}
	return n
}

// ChannelPostCountByDuration contains a count of posts by channel id, grouped by ISO8601 date string.
// Example 1 (grouped by day):
//  cpc := model.ChannelPostCountByDuration{
//  	"2009-11-11": {
//  		"ezbp7nqxzjgdir8riodyafr9ww": 90,
//  		"p949c1xdojfgzffxma3p3s3ikr": 201,
//  	},
//  	"2009-11-12": {
//  		"ezbp7nqxzjgdir8riodyafr9ww": 45,
//  		"p949c1xdojfgzffxma3p3s3ikr": 68,
//  	},
//  }
// Example 2 (grouped by hour):
//  cpc := model.ChannelPostCountByDuration{
//  	"2009-11-11T01": {
//  		"ezbp7nqxzjgdir8riodyafr9ww": 90,
//  		"p949c1xdojfgzffxma3p3s3ikr": 201,
//  	},
//  	"2009-11-11T02": {
//  		"ezbp7nqxzjgdir8riodyafr9ww": 45,
//  		"p949c1xdojfgzffxma3p3s3ikr": 68,
//  	},
//  }
type ChannelPostCountByDuration map[string]map[string]int

func ToDailyPostCountViewModel(dpc []*DurationPostCount, unixStartMillis int64, numDays int, channelIDs []string) ChannelPostCountByDuration {
	viewModel := ChannelPostCountByDuration{}

	startTime := time.Unix(unixStartMillis/1000, 0)

	if numDays == 1 {
		dayISO8601 := startTime.Format("2006-01-02")
		for i := 0; i <= 23; i++ {
			blankChannelCounts := map[string]int{}
			for _, id := range channelIDs {
				blankChannelCounts[id] = 0
			}
			viewModel[fmt.Sprintf("%sT%02d", dayISO8601, i)] = blankChannelCounts
		}
	} else {
		for i := 1; i <= numDays; i++ {
			blankChannelCounts := map[string]int{}
			for _, id := range channelIDs {
				blankChannelCounts[id] = 0
			}
			dayKey := startTime.AddDate(0, 0, i).Format("2006-01-02")
			viewModel[dayKey] = blankChannelCounts
		}
	}

	for _, item := range dpc {
		_, hasKey := viewModel[item.Duration]
		if !hasKey {
			viewModel[item.Duration] = map[string]int{}
		}
		viewModel[item.Duration][item.ChannelID] = item.PostCount
	}

	return viewModel
}

// GetStartUnixMilliForTimeRange gets the unix start time in milliseconds from the given time range.
// Time range can be one of: "today", "7_day", or "28_day".
func GetStartUnixMilliForTimeRange(timeRange string) (int64, *AppError) {
	now := time.Now()
	_, offset := now.Zone()
	switch timeRange {
	case TimeRangeToday:
		return GetStartOfDayMillis(now, offset), nil
	case TimeRange7Day:
		return GetStartOfDayMillis(now.Add(time.Hour*time.Duration(-168)), offset), nil
	case TimeRange28Day:
		return GetStartOfDayMillis(now.Add(time.Hour*time.Duration(-672)), offset), nil
	}

	return GetStartOfDayMillis(now, offset), NewAppError("Insights.IsValidRequest", "model.insights.time_range.app_error", nil, "", http.StatusBadRequest)
}

// GetTopReactionListWithPagination adds a rank to each item in the given list of TopReaction and checks if there is
// another page that can be fetched based on the given limit and offset. The given list of TopReaction is assumed to be
// sorted by Count. Returns a TopReactionList.
func GetTopReactionListWithPagination(reactions []*TopReaction, limit int) *TopReactionList {
	// Add pagination support
	var hasNext bool
	if (limit != 0) && (len(reactions) == limit+1) {
		hasNext = true
		reactions = reactions[:len(reactions)-1]
	}

	return &TopReactionList{InsightsListData: InsightsListData{HasNext: hasNext}, Items: reactions}
}

// GetTopChannelListWithPagination adds a rank to each item in the given list of TopChannel and checks if there is
// another page that can be fetched based on the given limit and offset. The given list of TopChannel is assumed to be
// sorted by Score. Returns a TopChannelList.
func GetTopChannelListWithPagination(channels []*TopChannel, limit int) *TopChannelList {
	// Add pagination support
	var hasNext bool
	if (limit != 0) && (len(channels) == limit+1) {
		hasNext = true
		channels = channels[:len(channels)-1]
	}

	return &TopChannelList{InsightsListData: InsightsListData{HasNext: hasNext}, Items: channels}
}
