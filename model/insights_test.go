// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetStartUnixMilliForTimeRang(t *testing.T) {
	tc := [3]string{"today", "7_day", "28_day"}

	for _, timeRange := range tc {
		t.Run(timeRange, func(t *testing.T) {
			_, err := GetStartUnixMilliForTimeRange(timeRange)
			assert.Nil(t, err)
		})
	}

	invalidTimeRanges := [3]string{"", "1_day", "10_day"}

	for _, timeRange := range invalidTimeRanges {
		t.Run(timeRange, func(t *testing.T) {
			_, err := GetStartUnixMilliForTimeRange(timeRange)
			assert.NotNil(t, err)
		})
	}
}

func TestGetTopReactionListWithPagination(t *testing.T) {
	reactions := []*TopReaction{
		{EmojiName: "smile", Count: 200},
		{EmojiName: "+1", Count: 190},
		{EmojiName: "100", Count: 100},
		{EmojiName: "-1", Count: 75},
		{EmojiName: "checkmark", Count: 50},
		{EmojiName: "mattermost", Count: 49}}

	hasNextTC := []struct {
		Description string
		Limit       int
		Offset      int
		Expected    *TopReactionList
	}{
		{
			Description: "has one page",
			Limit:       len(reactions),
			Offset:      0,
			Expected:    &TopReactionList{InsightsListData: InsightsListData{HasNext: false}, Items: reactions},
		},
		{
			Description: "has more than one page",
			Limit:       len(reactions) - 1,
			Offset:      0,
			Expected:    &TopReactionList{InsightsListData: InsightsListData{HasNext: true}, Items: reactions},
		},
	}

	for _, test := range hasNextTC {
		t.Run(test.Description, func(t *testing.T) {
			actual := GetTopReactionListWithPagination(reactions, test.Limit)
			assert.Equal(t, test.Expected.HasNext, actual.HasNext)
		})
	}
}

func TestGetTopChannelListWithPagination(t *testing.T) {
	channels := []*TopChannel{
		{ID: NewId(), MessageCount: 200},
		{ID: NewId(), MessageCount: 150},
		{ID: NewId(), MessageCount: 120},
		{ID: NewId(), MessageCount: 105},
		{ID: NewId(), MessageCount: 5},
		{ID: NewId(), MessageCount: 2}}

	hasNextTC := []struct {
		Description string
		Limit       int
		Offset      int
		Expected    *TopChannelList
	}{
		{
			Description: "has one page",
			Limit:       len(channels),
			Offset:      0,
			Expected:    &TopChannelList{InsightsListData: InsightsListData{HasNext: false}, Items: channels},
		},
		{
			Description: "has more than one page",
			Limit:       len(channels) - 1,
			Offset:      0,
			Expected:    &TopChannelList{InsightsListData: InsightsListData{HasNext: true}, Items: channels},
		},
	}

	for _, test := range hasNextTC {
		t.Run(test.Description, func(t *testing.T) {
			actual := GetTopChannelListWithPagination(channels, test.Limit)
			assert.Equal(t, test.Expected.HasNext, actual.HasNext)
		})
	}
}
