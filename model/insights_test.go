// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

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

func TestGetTopThreadListWithPagination(t *testing.T) {
	threads := []*TopThread{
		{PostId: NewId(), ReplyCount: 100},
		{PostId: NewId(), ReplyCount: 80},
		{PostId: NewId(), ReplyCount: 90},
		{PostId: NewId(), ReplyCount: 76},
		{PostId: NewId(), ReplyCount: 43},
		{PostId: NewId(), ReplyCount: 2},
		{PostId: NewId(), ReplyCount: 1},
	}
	hasNextTT := []struct {
		Description string
		Limit       int
		Offset      int
		Expected    *TopThreadList
	}{
		{
			Description: "has one page",
			Limit:       len(threads),
			Offset:      0,
			Expected:    &TopThreadList{InsightsListData: InsightsListData{HasNext: false}, Items: threads},
		},
		{
			Description: "has more than one page",
			Limit:       len(threads) - 1,
			Offset:      0,
			Expected:    &TopThreadList{InsightsListData: InsightsListData{HasNext: true}, Items: threads},
		},
	}

	for _, test := range hasNextTT {
		t.Run(test.Description, func(t *testing.T) {
			actual := GetTopThreadListWithPagination(threads, test.Limit)
			assert.Equal(t, test.Expected.HasNext, actual.HasNext)
		})
	}
}

func TestGetTopInactiveChannelListWithPagination(t *testing.T) {
	channels := []*TopInactiveChannel{
		{ID: NewId(), MessageCount: 2},
		{ID: NewId(), MessageCount: 5},
		{ID: NewId(), MessageCount: 7},
		{ID: NewId(), MessageCount: 80},
		{ID: NewId(), MessageCount: 85},
		{ID: NewId(), MessageCount: 92}}

	hasNextTC := []struct {
		Description string
		Limit       int
		Offset      int
		Expected    *TopInactiveChannelList
	}{
		{
			Description: "has one page",
			Limit:       len(channels),
			Offset:      0,
			Expected:    &TopInactiveChannelList{InsightsListData: InsightsListData{HasNext: false}, Items: channels},
		},
		{
			Description: "has more than one page",
			Limit:       len(channels) - 1,
			Offset:      0,
			Expected:    &TopInactiveChannelList{InsightsListData: InsightsListData{HasNext: true}, Items: channels},
		},
	}

	for _, test := range hasNextTC {
		t.Run(test.Description, func(t *testing.T) {
			actual := GetTopInactiveChannelListWithPagination(channels, test.Limit)
			assert.Equal(t, test.Expected.HasNext, actual.HasNext)
		})
	}
}

func TestGetTopDMsListWithPagination(t *testing.T) {
	dms := []*TopDM{
		{SecondParticipant: &TopDMInsightUserInformation{InsightUserInformation: InsightUserInformation{Id: NewId()}}, MessageCount: 100},
		{SecondParticipant: &TopDMInsightUserInformation{InsightUserInformation: InsightUserInformation{Id: NewId()}}, MessageCount: 80},
		{SecondParticipant: &TopDMInsightUserInformation{InsightUserInformation: InsightUserInformation{Id: NewId()}}, MessageCount: 90},
		{SecondParticipant: &TopDMInsightUserInformation{InsightUserInformation: InsightUserInformation{Id: NewId()}}, MessageCount: 76},
		{SecondParticipant: &TopDMInsightUserInformation{InsightUserInformation: InsightUserInformation{Id: NewId()}}, MessageCount: 43},
		{SecondParticipant: &TopDMInsightUserInformation{InsightUserInformation: InsightUserInformation{Id: NewId()}}, MessageCount: 2},
		{SecondParticipant: &TopDMInsightUserInformation{InsightUserInformation: InsightUserInformation{Id: NewId()}}, MessageCount: 1},
	}
	hasNextTT := []struct {
		Description string
		Limit       int
		Offset      int
		Expected    *TopDMList
	}{
		{
			Description: "has one page",
			Limit:       len(dms),
			Offset:      0,
			Expected:    &TopDMList{InsightsListData: InsightsListData{HasNext: false}, Items: dms},
		},
		{
			Description: "has more than one page",
			Limit:       len(dms) - 1,
			Offset:      0,
			Expected:    &TopDMList{InsightsListData: InsightsListData{HasNext: true}, Items: dms},
		},
	}

	for _, test := range hasNextTT {
		t.Run(test.Description, func(t *testing.T) {
			actual := GetTopDMListWithPagination(dms, test.Limit)
			assert.Equal(t, test.Expected.HasNext, actual.HasNext)
		})
	}
}
