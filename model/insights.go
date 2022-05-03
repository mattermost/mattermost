// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"time"
)

const (
	TimeRangeToday string = "today"
	TimeRange7Day  string = "7_day"
	TimeRange28Day string = "28_day"
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
	Items          []*TopChannel         `json:"items"`
	PostCountByDay ChannelPostCountByDay `json:"daily_channel_post_counts"`
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

type DailyPostCount struct {
	ChannelID string `db:"channelid" json:"channel_id"`
	Date      string `db:"day" json:"-"`
	PostCount int    `db:"postcount" json:"post_count"`
}

func (d *DailyPostCount) ISO8601Date() string {
	if len(d.Date) >= 10 {
		return d.Date[:10]
	}
	return ""
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

// ChannelPostCountByDay contains a count of posts by channel id, grouped by ISO8601 date string. For example:
//  cpc := model.ChannelPostCountByDay{
//  	"2009-11-11": {
//  		"ezbp7nqxzjgdir8riodyafr9ww": 90,
//  		"p949c1xdojfgzffxma3p3s3ikr": 201,
//  	},
//  	"2009-11-12": {
//  		"ezbp7nqxzjgdir8riodyafr9ww": 45,
//  		"p949c1xdojfgzffxma3p3s3ikr": 68,
//  	},
//  }
type ChannelPostCountByDay map[string]map[string]int

func ToDailyPostCountViewModel(dpc []*DailyPostCount, unixStartMillis int64, numDays int, channelIDs []string) ChannelPostCountByDay {
	viewModel := ChannelPostCountByDay{}

	startTime := time.Unix(unixStartMillis/1000, 0)

	for i := 1; i <= numDays; i++ {
		blankChannelCounts := map[string]int{}
		for _, id := range channelIDs {
			blankChannelCounts[id] = 0
		}
		dayKey := startTime.AddDate(0, 0, i).Format("2006-01-02")
		viewModel[dayKey] = blankChannelCounts
	}

	for _, item := range dpc {
		isoDay := item.ISO8601Date()
		_, hasKey := viewModel[isoDay]
		if !hasKey {
			viewModel[isoDay] = map[string]int{}
		}
		viewModel[isoDay][item.ChannelID] = item.PostCount
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
