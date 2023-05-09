// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package model

// BaordsComplianceResponse is the response body to a request for boards.
// swagger:model
type BoardsComplianceResponse struct {
	// True if there is a next page for pagination
	// required: true
	HasNext bool `json:"hasNext"`

	// The array of board records.
	// required: true
	Results []*Board `json:"results"`
}

// BoardsComplianceHistoryResponse is the response body to a request for boards history.
// swagger:model
type BoardsComplianceHistoryResponse struct {
	// True if there is a next page for pagination
	// required: true
	HasNext bool `json:"hasNext"`

	// The array of BoardHistory records.
	// required: true
	Results []*BoardHistory `json:"results"`
}

// BlocksComplianceHistoryResponse is the response body to a request for blocks history.
// swagger:model
type BlocksComplianceHistoryResponse struct {
	// True if there is a next page for pagination
	// required: true
	HasNext bool `json:"hasNext"`

	// The array of BlockHistory records.
	// required: true
	Results []*BlockHistory `json:"results"`
}

// BoardHistory provides information about the history of a board.
// swagger:model
type BoardHistory struct {
	ID                      string `json:"id"`
	TeamID                  string `json:"teamId"`
	IsDeleted               bool   `json:"isDeleted"`
	DescendantLastUpdateAt  int64  `json:"descendantLastUpdateAt"`
	DescendantFirstUpdateAt int64  `json:"descendantFirstUpdateAt"`
	CreatedBy               string `json:"createdBy"`
	LastModifiedBy          string `json:"lastModifiedBy"`
}

// BlockHistory provides information about the history of a block.
// swagger:model
type BlockHistory struct {
	ID             string `json:"id"`
	TeamID         string `json:"teamId"`
	BoardID        string `json:"boardId"`
	Type           string `json:"type"`
	IsDeleted      bool   `json:"isDeleted"`
	LastUpdateAt   int64  `json:"lastUpdateAt"`
	FirstUpdateAt  int64  `json:"firstUpdateAt"`
	CreatedBy      string `json:"createdBy"`
	LastModifiedBy string `json:"lastModifiedBy"`
}

type QueryBoardsForComplianceOptions struct {
	TeamID  string // if not empty then filter for specific team, otherwise all teams are included
	Page    int    // page number to select when paginating
	PerPage int    // number of blocks per page (default=60)
}

type QueryBoardsComplianceHistoryOptions struct {
	ModifiedSince  int64  // if non-zero then filter for records with update_at greater than ModifiedSince
	IncludeDeleted bool   // if true then deleted blocks are included
	TeamID         string // if not empty then filter for specific team, otherwise all teams are included
	Page           int    // page number to select when paginating
	PerPage        int    // number of blocks per page (default=60)
}

type QueryBlocksComplianceHistoryOptions struct {
	ModifiedSince  int64  // if non-zero then filter for records with update_at greater than ModifiedSince
	IncludeDeleted bool   // if true then deleted blocks are included
	TeamID         string // if not empty then filter for specific team, otherwise all teams are included
	BoardID        string // if not empty then filter for specific board, otherwise all boards are included
	Page           int    // page number to select when paginating
	PerPage        int    // number of blocks per page (default=60)
}
