// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package model

// BoardsStatistics is the representation of the statistics for the Boards server
// swagger:model
type BoardsStatistics struct {
	// The maximum number of cards on the server
	// required: true
	Boards int `json:"board_count"`

	// The maximum number of cards on the server
	// required: true
	Cards int `json:"card_count"`
}
