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

func TestGetTopReactionListWithRankAndPagination(t *testing.T) {

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
			actual := GetTopReactionListWithRankAndPagination(reactions, test.Limit, test.Offset)
			assert.Equal(t, test.Expected.HasNext, actual.HasNext)
		})
	}

	t.Run("ranks for first and second page", func(t *testing.T) {
		firstPage := GetTopReactionListWithRankAndPagination(reactions, 5, 0)

		for i, r := range firstPage.Items {
			assert.Equal(t, i+1, r.Rank)
		}

		secondPage := GetTopReactionListWithRankAndPagination(reactions, 5, 5)
		for i, r := range secondPage.Items {
			assert.Equal(t, i+1+5, r.Rank)
		}
	})
}
