// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"

	mm_model "github.com/mattermost/mattermost-server/server/v8/model"
)

// BoardInsightsList is a response type with pagination support.
type BoardInsightsList struct {
	mm_model.InsightsListData
	Items []*BoardInsight `json:"items"`
}

// BoardInsight gives insight into activities in a Board
// swagger:model
type BoardInsight struct {
	// ID of the board
	// required: true
	BoardID string `json:"boardID"`

	// icon of the board
	// required: false
	Icon string `json:"icon"`

	// Title of the board
	// required: false
	Title string `json:"title"`

	// Metric of how active the board is
	// required: true
	ActivityCount string `json:"activityCount"`

	// IDs of users active on the board
	// required: true
	ActiveUsers mm_model.StringArray `json:"activeUsers"`

	// ID of user who created the board
	// required: true
	CreatedBy string `json:"createdBy"`
}

func BoardInsightsFromJSON(data io.Reader) []BoardInsight {
	var boardInsights []BoardInsight
	_ = json.NewDecoder(data).Decode(&boardInsights)
	return boardInsights
}

// GetTopBoardInsightsListWithPagination adds a rank to each item in the given list of BoardInsight and checks if there is
// another page that can be fetched based on the given limit and offset. The given list of BoardInsight is assumed to be
// sorted by ActivityCount(score). Returns a BoardInsightsList.
func GetTopBoardInsightsListWithPagination(boards []*BoardInsight, limit int) *BoardInsightsList {
	// Add pagination support
	var hasNext bool
	if limit != 0 && len(boards) == limit+1 {
		hasNext = true
		boards = boards[:len(boards)-1]
	}

	return &BoardInsightsList{InsightsListData: mm_model.InsightsListData{HasNext: hasNext}, Items: boards}
}
