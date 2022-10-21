// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
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

// Top Channels
type TopInactiveChannelList struct {
	InsightsListData
	Items []*TopInactiveChannel `json:"items"`
}

type TopInactiveChannel struct {
	ID             string      `json:"id"`
	Type           ChannelType `json:"type"`
	DisplayName    string      `json:"display_name"`
	Name           string      `json:"name"`
	LastActivityAt int64       `json:"last_activity_at"`
	Participants   StringArray `json:"participants"`
	MessageCount   int64       `json:"-"`
}

// Top Threads
type TopThreadList struct {
	InsightsListData
	Items []*TopThread `json:"items"`
}

type TopThread struct {
	PostId          string                  `json:"-"`
	ReplyCount      int64                   `json:"-"`
	ChannelId       string                  `json:"channel_id"`
	DisplayName     string                  `json:"channel_display_name"`
	Name            string                  `json:"channel_name"`
	Participants    StringArray             `json:"participants"`
	UserId          string                  `json:"-"`
	UserInformation *InsightUserInformation `json:"user_information"`
	Post            *Post                   `json:"post"`
}

type InsightUserInformation struct {
	Id                string `json:"id"`
	LastPictureUpdate int64  `json:"last_picture_update"`
	FirstName         string `json:"first_name"`
	LastName          string `json:"last_name"`
	NickName          string `json:"nickname"`
	Username          string `json:"username"`
}

type TopDMInsightUserInformation struct {
	InsightUserInformation
	Position string `json:"position"`
}
type NewTeamMembersList struct {
	InsightsListData
	Items      []*NewTeamMember `json:"items"`
	TotalCount int64            `json:"total_count"`
}

type NewTeamMember struct {
	Id        string `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Position  string `json:"position"`
	Nickname  string `json:"nickname"`
	CreateAt  int64  `json:"create_at"`
}

type DurationPostCount struct {
	ChannelID string `db:"channelid"`
	// Duration is an ISO8601 date string.
	Duration  string `db:"duration"`
	PostCount int    `db:"postcount"`
}

// Top DMs
type TopDM struct {
	MessageCount         int64                        `json:"post_count"`
	OutgoingMessageCount int64                        `json:"outgoing_message_count"`
	Participants         string                       `json:"-"`
	ChannelId            string                       `json:"-"`
	SecondParticipant    *TopDMInsightUserInformation `json:"second_participant"`
}

type OutgoingMessageQueryResult struct {
	ChannelId    string
	MessageCount int
}

type TopDMList struct {
	InsightsListData
	Items []*TopDM `json:"items"`
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
//
//	cpc := model.ChannelPostCountByDuration{
//		"2009-11-11": {
//			"ezbp7nqxzjgdir8riodyafr9ww": 90,
//			"p949c1xdojfgzffxma3p3s3ikr": 201,
//		},
//		"2009-11-12": {
//			"ezbp7nqxzjgdir8riodyafr9ww": 45,
//			"p949c1xdojfgzffxma3p3s3ikr": 68,
//		},
//	}
//
// Example 2 (grouped by hour):
//
//	cpc := model.ChannelPostCountByDuration{
//		"2009-11-11T01": {
//			"ezbp7nqxzjgdir8riodyafr9ww": 90,
//			"p949c1xdojfgzffxma3p3s3ikr": 201,
//		},
//		"2009-11-11T02": {
//			"ezbp7nqxzjgdir8riodyafr9ww": 45,
//			"p949c1xdojfgzffxma3p3s3ikr": 68,
//		},
//	}
type ChannelPostCountByDuration map[string]map[string]int

func blankChannelCountsMap(channelIDs []string) map[string]int {
	blankChannelCounts := map[string]int{}
	for _, id := range channelIDs {
		blankChannelCounts[id] = 0
	}
	return blankChannelCounts
}

func ToDailyPostCountViewModel(dpc []*DurationPostCount, startTime *time.Time, numDays int, channelIDs []string) ChannelPostCountByDuration {
	viewModel := ChannelPostCountByDuration{}

	keyTime := *startTime
	nowAtLocation := time.Now().In(startTime.Location())

	if numDays == 1 {
		for keyTime.Before(nowAtLocation) {
			dateTimeKey := keyTime.Format(time.RFC3339)
			viewModel[dateTimeKey] = blankChannelCountsMap(channelIDs)
			keyTime = keyTime.Add(time.Hour)
		}
	} else {
		for keyTime.Before(nowAtLocation) {
			dateTimeKey := keyTime.Format("2006-01-02")
			viewModel[dateTimeKey] = blankChannelCountsMap(channelIDs)
			keyTime = keyTime.Add(24 * time.Hour)
		}
	}

	for _, item := range dpc {
		var parseFormat string
		var keyFormat string
		if numDays == 1 {
			parseFormat = "2006-01-02T15 "
			keyFormat = time.RFC3339
		} else {
			parseFormat = "2006-01-02"
			keyFormat = parseFormat
		}
		durTime, err := time.ParseInLocation(parseFormat, item.Duration, startTime.Location())
		if err != nil {
			continue
		}
		localizedKey := durTime.Format(keyFormat)
		_, hasKey := viewModel[localizedKey]
		if !hasKey {
			viewModel[localizedKey] = map[string]int{}
		}
		viewModel[localizedKey][item.ChannelID] = item.PostCount
	}

	return viewModel
}

// StartOfDayForTimeRange gets the unix start time in milliseconds from the given time range.
// Time range can be one of: "today", "7_day", or "28_day".
func StartOfDayForTimeRange(timeRange string, location *time.Location) *time.Time {
	now := time.Now().In(location)
	resultTime := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	switch timeRange {
	case TimeRange7Day:
		resultTime = resultTime.Add(time.Hour * time.Duration(-144))
	case TimeRange28Day:
		resultTime = resultTime.Add(time.Hour * time.Duration(-648))
	}
	return &resultTime
}

// GetStartOfDayForTimeRange gets the unix start time in milliseconds from the given time range.
// Time range can be one of: "today", "7_day", or "28_day".
func GetStartOfDayForTimeRange(timeRange string, location *time.Location) (*time.Time, *AppError) {
	now := time.Now().In(location)
	resultTime := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	switch timeRange {
	case TimeRangeToday:
	case TimeRange7Day:
		resultTime = resultTime.Add(time.Hour * time.Duration(-144))
	case TimeRange28Day:
		resultTime = resultTime.Add(time.Hour * time.Duration(-648))
	default:
		return nil, NewAppError("GetStartOfDayForTimeRange", "model.insights.get_start_of_day_for_time_range.time_range.app_error", nil, "", http.StatusBadRequest)
	}
	return &resultTime, nil
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

// GetTopThreadListWithPagination adds a rank to each item in the given list of TopThread and checks if there is
// another page that can be fetched based on the given limit and offset. The given list of TopThread is assumed to be
// sorted by ReplyCount(score). Returns a TopThreadList.
func GetTopThreadListWithPagination(threads []*TopThread, limit int) *TopThreadList {
	// Add pagination support
	var hasNext bool
	if (limit != 0) && (len(threads) == limit+1) {
		hasNext = true
		threads = threads[:len(threads)-1]
	}

	return &TopThreadList{InsightsListData: InsightsListData{HasNext: hasNext}, Items: threads}
}

// GetTopInactiveChannelListWithPagination adds a rank to each item in the given list of TopInactiveChannel and checks if there is
// another page that can be fetched based on the given limit and offset. The given list of TopInactiveChannel is assumed to be
// sorted by Score. Returns a TopInactiveChannelList.
func GetTopInactiveChannelListWithPagination(channels []*TopInactiveChannel, limit int) *TopInactiveChannelList {
	// Add pagination support
	var hasNext bool
	if (limit != 0) && (len(channels) == limit+1) {
		hasNext = true
		channels = channels[:len(channels)-1]
	}

	return &TopInactiveChannelList{InsightsListData: InsightsListData{HasNext: hasNext}, Items: channels}
}

// GetTopDMListWithPagination adds a rank to each item in the given list of TopDM and checks if there is
// another page that can be fetched based on the given limit and offset. The given list of TopDM is assumed to be
// sorted by MessageCount(score). Returns a TopDMList.
func GetTopDMListWithPagination(dms []*TopDM, limit int) *TopDMList {
	// Add pagination support
	var hasNext bool
	if (limit != 0) && (len(dms) == limit+1) {
		hasNext = true
		dms = dms[:len(dms)-1]
	}

	return &TopDMList{InsightsListData: InsightsListData{HasNext: hasNext}, Items: dms}
}

func GetNewTeamMembersListWithPagination(teamMembers []*NewTeamMember, limit int) *NewTeamMembersList {
	var hasNext bool
	if (limit != 0) && (len(teamMembers) == limit+1) {
		hasNext = true
		teamMembers = teamMembers[:len(teamMembers)-1]
	}

	return &NewTeamMembersList{InsightsListData: InsightsListData{HasNext: hasNext}, Items: teamMembers}
}
